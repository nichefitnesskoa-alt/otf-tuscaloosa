
-- =========================================================================
-- Fix duplicate vip_registrations created when self-registered members
-- later got bookings via the Pipeline "Add Member" flow.
--
-- Root cause: previous backfill + trigger only checked booking_id linkage,
-- so any pre-existing self-registration row (booking_id NULL) on the same
-- session got *another* row added when its booking was created.
-- =========================================================================

-- ---------- 1. MERGE DUPLICATES BY (session, normalized phone) -----------
-- Survivor = earliest created_at. Promote any sibling's booking_id / email /
-- last_name onto the survivor before deleting siblings.
WITH ranked AS (
  SELECT
    id,
    vip_session_id,
    regexp_replace(COALESCE(phone, ''), '\D', '', 'g') AS norm_phone,
    booking_id,
    email,
    last_name,
    is_group_contact,
    created_at,
    ROW_NUMBER() OVER (
      PARTITION BY vip_session_id, regexp_replace(COALESCE(phone, ''), '\D', '', 'g')
      ORDER BY created_at ASC, id ASC
    ) AS rn
  FROM public.vip_registrations
  WHERE vip_session_id IS NOT NULL
    AND COALESCE(phone, '') <> ''
),
survivors AS (
  SELECT * FROM ranked WHERE rn = 1
),
losers AS (
  SELECT * FROM ranked WHERE rn > 1
),
-- For each survivor, pick the best non-null values from any sibling
promoted AS (
  SELECT
    s.id AS survivor_id,
    (ARRAY_REMOVE(ARRAY_AGG(l.booking_id ORDER BY l.created_at), NULL))[1] AS new_booking_id,
    (ARRAY_REMOVE(ARRAY_AGG(NULLIF(l.email, '') ORDER BY l.created_at), NULL))[1] AS new_email,
    (ARRAY_REMOVE(ARRAY_AGG(NULLIF(l.last_name, '') ORDER BY l.created_at), NULL))[1] AS new_last_name,
    BOOL_OR(l.is_group_contact) AS any_group_contact
  FROM survivors s
  JOIN losers l
    ON l.vip_session_id = s.vip_session_id
   AND l.norm_phone     = s.norm_phone
  GROUP BY s.id
)
UPDATE public.vip_registrations vr
SET
  booking_id      = COALESCE(vr.booking_id, p.new_booking_id),
  email           = COALESCE(NULLIF(vr.email, ''), p.new_email),
  last_name       = COALESCE(NULLIF(vr.last_name, ''), p.new_last_name),
  is_group_contact = vr.is_group_contact OR COALESCE(p.any_group_contact, false)
FROM promoted p
WHERE vr.id = p.survivor_id;

-- Now delete the duplicates
DELETE FROM public.vip_registrations vr
USING (
  SELECT id FROM (
    SELECT
      id,
      ROW_NUMBER() OVER (
        PARTITION BY vip_session_id, regexp_replace(COALESCE(phone, ''), '\D', '', 'g')
        ORDER BY created_at ASC, id ASC
      ) AS rn
    FROM public.vip_registrations
    WHERE vip_session_id IS NOT NULL
      AND COALESCE(phone, '') <> ''
  ) r
  WHERE r.rn > 1
) dup
WHERE vr.id = dup.id;

-- ---------- 2. UNIQUE PARTIAL INDEX TO PREVENT FUTURE DUPLICATES ---------
-- One registration per (session, normalized-phone) when phone is present.
CREATE UNIQUE INDEX IF NOT EXISTS vip_registrations_session_phone_uniq
  ON public.vip_registrations (vip_session_id, (regexp_replace(phone, '\D', '', 'g')))
  WHERE phone IS NOT NULL AND phone <> '';

-- ---------- 3. HARDEN TRIGGER: match-or-update instead of always insert ---
CREATE OR REPLACE FUNCTION public.auto_create_vip_registration()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_first text;
  v_last  text;
  v_session_id uuid;
  v_class_name text;
  v_norm_phone text;
  v_existing_id uuid;
BEGIN
  -- Only act on VIP-class bookings
  IF NEW.lead_source IS NULL OR NEW.lead_source <> 'VIP Class' THEN
    RETURN NEW;
  END IF;

  -- Skip if a registration already points at this booking
  IF EXISTS (SELECT 1 FROM vip_registrations WHERE booking_id = NEW.id) THEN
    RETURN NEW;
  END IF;

  -- Resolve session id
  v_session_id := NEW.vip_session_id;
  IF v_session_id IS NULL AND NEW.vip_class_name IS NOT NULL THEN
    SELECT id INTO v_session_id
    FROM vip_sessions
    WHERE reserved_by_group = NEW.vip_class_name
       OR vip_class_name    = NEW.vip_class_name
    ORDER BY archived_at NULLS FIRST, created_at DESC
    LIMIT 1;
  END IF;

  IF v_session_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_class_name := COALESCE(
    NEW.vip_class_name,
    (SELECT COALESCE(reserved_by_group, vip_class_name) FROM vip_sessions WHERE id = v_session_id)
  );

  v_first := split_part(NEW.member_name, ' ', 1);
  v_last  := CASE
    WHEN position(' ' IN NEW.member_name) > 0
      THEN substring(NEW.member_name FROM position(' ' IN NEW.member_name) + 1)
    ELSE NULL
  END;

  -- Try to find an existing registration in the same session that matches by
  -- normalized phone (strongest signal) or, if no phone, by name.
  v_norm_phone := regexp_replace(COALESCE(NEW.phone, ''), '\D', '', 'g');

  IF v_norm_phone <> '' THEN
    SELECT id INTO v_existing_id
    FROM vip_registrations
    WHERE vip_session_id = v_session_id
      AND regexp_replace(COALESCE(phone, ''), '\D', '', 'g') = v_norm_phone
    ORDER BY created_at ASC
    LIMIT 1;
  END IF;

  IF v_existing_id IS NULL AND v_first IS NOT NULL THEN
    SELECT id INTO v_existing_id
    FROM vip_registrations
    WHERE vip_session_id = v_session_id
      AND lower(COALESCE(first_name, '')) = lower(v_first)
      AND lower(COALESCE(last_name, ''))  = lower(COALESCE(NULLIF(v_last, ''), ''))
      AND (phone IS NULL OR phone = '')
    ORDER BY created_at ASC
    LIMIT 1;
  END IF;

  IF v_existing_id IS NOT NULL THEN
    -- Attach booking to existing registration; backfill blanks; never overwrite real data.
    UPDATE vip_registrations
    SET
      booking_id = NEW.id,
      last_name  = COALESCE(NULLIF(last_name, ''), NULLIF(v_last, '')),
      email      = COALESCE(NULLIF(email, ''), NEW.email),
      phone      = COALESCE(NULLIF(phone, ''), NEW.phone)
    WHERE id = v_existing_id;
  ELSE
    INSERT INTO vip_registrations (
      first_name, last_name, phone, email,
      vip_class_name, vip_session_id, booking_id, is_group_contact
    ) VALUES (
      v_first, NULLIF(v_last, ''),
      NEW.phone, NEW.email,
      v_class_name, v_session_id, NEW.id, false
    );
  END IF;

  -- Stamp session id on booking if it was missing
  IF NEW.vip_session_id IS NULL THEN
    UPDATE intros_booked SET vip_session_id = v_session_id WHERE id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$;
