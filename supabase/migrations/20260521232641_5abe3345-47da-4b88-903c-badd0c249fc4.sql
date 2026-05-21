
-- Trigger: keep vip_registrations in sync with vip_sessions.reserved_contact_*
CREATE OR REPLACE FUNCTION public.sync_vip_group_contact_registration()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_first text;
  v_last text;
  v_existing_id uuid;
BEGIN
  IF NEW.reserved_contact_name IS NULL OR btrim(NEW.reserved_contact_name) = '' THEN
    RETURN NEW;
  END IF;

  v_first := split_part(NEW.reserved_contact_name, ' ', 1);
  v_last := CASE
    WHEN position(' ' IN NEW.reserved_contact_name) > 0
      THEN substring(NEW.reserved_contact_name FROM position(' ' IN NEW.reserved_contact_name) + 1)
    ELSE NULL
  END;

  SELECT id INTO v_existing_id
  FROM public.vip_registrations
  WHERE vip_session_id = NEW.id AND is_group_contact = true
  LIMIT 1;

  IF v_existing_id IS NULL THEN
    INSERT INTO public.vip_registrations (
      first_name, last_name, phone, email,
      vip_class_name, vip_session_id, is_group_contact
    ) VALUES (
      v_first, NULLIF(v_last, ''),
      NEW.reserved_contact_phone, NEW.reserved_contact_email,
      COALESCE(NEW.reserved_by_group, NEW.vip_class_name),
      NEW.id, true
    );
  ELSE
    UPDATE public.vip_registrations
    SET
      first_name = v_first,
      last_name  = NULLIF(v_last, ''),
      phone      = COALESCE(NEW.reserved_contact_phone, phone),
      email      = COALESCE(NEW.reserved_contact_email, email)
    WHERE id = v_existing_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_vip_group_contact ON public.vip_sessions;
CREATE TRIGGER trg_sync_vip_group_contact
AFTER INSERT OR UPDATE OF reserved_contact_name, reserved_contact_phone, reserved_contact_email
ON public.vip_sessions
FOR EACH ROW
EXECUTE FUNCTION public.sync_vip_group_contact_registration();

-- Backfill: create group-contact registration rows for any existing sessions missing one
INSERT INTO public.vip_registrations (
  first_name, last_name, phone, email,
  vip_class_name, vip_session_id, is_group_contact
)
SELECT
  split_part(s.reserved_contact_name, ' ', 1) AS first_name,
  NULLIF(
    CASE WHEN position(' ' IN s.reserved_contact_name) > 0
      THEN substring(s.reserved_contact_name FROM position(' ' IN s.reserved_contact_name) + 1)
      ELSE NULL
    END, ''
  ) AS last_name,
  s.reserved_contact_phone,
  s.reserved_contact_email,
  COALESCE(s.reserved_by_group, s.vip_class_name),
  s.id,
  true
FROM public.vip_sessions s
WHERE s.reserved_contact_name IS NOT NULL
  AND btrim(s.reserved_contact_name) <> ''
  AND NOT EXISTS (
    SELECT 1 FROM public.vip_registrations r
    WHERE r.vip_session_id = s.id AND r.is_group_contact = true
  );
