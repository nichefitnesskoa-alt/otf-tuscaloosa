
-- 1. Fill missing vip_session_id on intros_booked rows that name a known VIP group
UPDATE intros_booked b
SET vip_session_id = s.id,
    last_edited_at = now(),
    last_edited_by = 'System (VIP backfill)',
    edit_reason    = 'Linked booking to vip_sessions row by group name'
FROM vip_sessions s
WHERE b.lead_source = 'VIP Class'
  AND b.vip_session_id IS NULL
  AND b.deleted_at IS NULL
  AND (s.reserved_by_group = b.vip_class_name OR s.vip_class_name = b.vip_class_name);

-- 2. Backfill vip_registrations for every VIP-class booking that doesn't have one yet
INSERT INTO vip_registrations (
  first_name, last_name, phone, email,
  vip_class_name, vip_session_id, booking_id, is_group_contact
)
SELECT
  split_part(b.member_name, ' ', 1) AS first_name,
  NULLIF(
    CASE
      WHEN position(' ' IN b.member_name) > 0
        THEN substring(b.member_name FROM position(' ' IN b.member_name) + 1)
      ELSE ''
    END, ''
  ) AS last_name,
  b.phone,
  b.email,
  COALESCE(b.vip_class_name, s.vip_class_name, s.reserved_by_group) AS vip_class_name,
  COALESCE(b.vip_session_id, s.id) AS vip_session_id,
  b.id AS booking_id,
  false AS is_group_contact
FROM intros_booked b
LEFT JOIN vip_sessions s
  ON s.reserved_by_group = b.vip_class_name
  OR s.vip_class_name    = b.vip_class_name
WHERE b.lead_source = 'VIP Class'
  AND b.deleted_at IS NULL
  AND COALESCE(b.vip_session_id, s.id) IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM vip_registrations r WHERE r.booking_id = b.id
  );

-- 3. Safety net trigger: any future VIP-class booking auto-creates its registration row
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
BEGIN
  -- Only act on VIP-class bookings
  IF NEW.lead_source IS NULL OR NEW.lead_source <> 'VIP Class' THEN
    RETURN NEW;
  END IF;

  -- Skip if a registration already exists for this booking
  IF EXISTS (SELECT 1 FROM vip_registrations WHERE booking_id = NEW.id) THEN
    RETURN NEW;
  END IF;

  -- Resolve session id (use the one on the booking, else look it up by group name)
  v_session_id := NEW.vip_session_id;
  IF v_session_id IS NULL AND NEW.vip_class_name IS NOT NULL THEN
    SELECT id INTO v_session_id
    FROM vip_sessions
    WHERE reserved_by_group = NEW.vip_class_name
       OR vip_class_name    = NEW.vip_class_name
    ORDER BY archived_at NULLS FIRST, created_at DESC
    LIMIT 1;
  END IF;

  -- Without a session id, the My Day card can't show them anyway — bail
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

  INSERT INTO vip_registrations (
    first_name, last_name, phone, email,
    vip_class_name, vip_session_id, booking_id, is_group_contact
  ) VALUES (
    v_first, NULLIF(v_last, ''),
    NEW.phone, NEW.email,
    v_class_name, v_session_id, NEW.id, false
  );

  -- Also stamp the booking with the session id if it was missing
  IF NEW.vip_session_id IS NULL THEN
    UPDATE intros_booked SET vip_session_id = v_session_id WHERE id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_create_vip_registration ON public.intros_booked;
CREATE TRIGGER trg_auto_create_vip_registration
AFTER INSERT ON public.intros_booked
FOR EACH ROW
EXECUTE FUNCTION public.auto_create_vip_registration();
