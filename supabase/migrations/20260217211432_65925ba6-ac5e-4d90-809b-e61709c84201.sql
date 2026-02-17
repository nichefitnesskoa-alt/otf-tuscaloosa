
-- 1) Normalize intro_time to canonical HH24:MI (returns time type)
CREATE OR REPLACE FUNCTION public.to_intro_time_canonical(p text)
RETURNS time
LANGUAGE plpgsql
AS $$
DECLARE
  s text := btrim(coalesce(p,''));
  t text;
BEGIN
  IF s = '' THEN RETURN NULL; END IF;
  -- already canonical HH:MI or HH:MI:SS
  IF s ~ '^[0-2][0-9]:[0-5][0-9](:[0-5][0-9])?$' THEN
    RETURN s::time;
  END IF;
  -- formats like "6:00 PM" / "06:00PM"
  IF s ~* '^[0-9]{1,2}:[0-9]{2}\s*(am|pm)$' THEN
    t := to_char(to_timestamp(upper(s), 'HH12:MI AM'), 'HH24:MI');
    RETURN t::time;
  END IF;
  -- formats like "6 PM"
  IF s ~* '^[0-9]{1,2}\s*(am|pm)$' THEN
    t := to_char(to_timestamp(upper(regexp_replace(s,'\s+',' ', 'g')), 'HH12 AM'), 'HH24:MI');
    RETURN t::time;
  END IF;
  RETURN NULL;
END;
$$;

-- 2) Trigger to enforce canonical storage + maintain class_start_at
CREATE OR REPLACE FUNCTION public.enforce_intro_time_canon()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- maintain class_start_at whenever class_date or intro_time changes
  IF new.class_date IS NOT NULL AND new.intro_time IS NOT NULL THEN
    BEGIN
      new.class_start_at := (new.class_date::date + new.intro_time);
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_intro_time_canon ON public.intros_booked;
CREATE TRIGGER trg_enforce_intro_time_canon
BEFORE INSERT OR UPDATE OF intro_time, class_date
ON public.intros_booked
FOR EACH ROW
EXECUTE FUNCTION public.enforce_intro_time_canon();

-- 3) Backfill class_start_at from existing class_date + intro_time
UPDATE public.intros_booked
SET class_start_at = (class_date::date + intro_time)
WHERE intro_time IS NOT NULL
  AND class_start_at IS NULL;

-- 4) Backfill booking_type_canon for VIP reliably
UPDATE public.intros_booked
SET booking_type_canon = 'VIP'
WHERE (booking_type_canon IS NULL OR booking_type_canon = 'STANDARD')
  AND (
    coalesce(is_vip, false) = true
    OR (lead_source IS NOT NULL AND lower(lead_source) LIKE '%vip%')
    OR vip_session_id IS NOT NULL
  );

-- 5) Improved self-booked auto-set trigger
CREATE OR REPLACE FUNCTION public.auto_set_booked_by_self_booked()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF (NEW.booked_by IS NULL OR btrim(NEW.booked_by) = '')
     AND NEW.lead_source IS NOT NULL
     AND lower(NEW.lead_source) IN ('online intro offer', 'online intro offer (self-booked)', 'online intro', 'website', 'web') THEN
    NEW.booked_by := 'Self booked';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_set_booked_by ON public.intros_booked;
CREATE TRIGGER trg_auto_set_booked_by
BEFORE INSERT ON public.intros_booked
FOR EACH ROW
EXECUTE FUNCTION public.auto_set_booked_by_self_booked();

-- 6) Update backfill_booking_phones to use intake_events
CREATE OR REPLACE FUNCTION public.backfill_booking_phones(p_days_back int DEFAULT 365)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_updated int := 0;
  v_rec RECORD;
  v_digits text;
BEGIN
  FOR v_rec IN
    SELECT b.id, ie.payload
    FROM public.intros_booked b
    JOIN public.intake_events ie ON ie.booking_id = b.id
    WHERE b.phone_e164 IS NULL
      AND b.created_at >= now() - (p_days_back || ' days')::interval
      AND ie.payload IS NOT NULL
  LOOP
    v_digits := regexp_replace(
      (regexp_match(v_rec.payload::text, '(\(?\d{3}\)?[\s.\-]?\d{3}[\s.\-]?\d{4})'))[1],
      '[^0-9]', '', 'g'
    );
    IF v_digits IS NOT NULL AND length(v_digits) = 10 THEN
      UPDATE public.intros_booked
      SET phone_e164 = '+1' || v_digits,
          phone_source = 'email_parse_backfill'
      WHERE id = v_rec.id AND phone_e164 IS NULL;
      v_updated := v_updated + 1;
    END IF;
  END LOOP;
  RETURN json_build_object('updated', v_updated);
END;
$$;
