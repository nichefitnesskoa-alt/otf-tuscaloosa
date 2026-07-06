-- Trigger: interpret naive (class_date + intro_time) as America/Chicago.
CREATE OR REPLACE FUNCTION public.enforce_intro_time_canon()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF new.class_date IS NOT NULL AND new.intro_time IS NOT NULL THEN
    BEGIN
      new.class_start_at := ((new.class_date::date + new.intro_time) AT TIME ZONE 'America/Chicago');
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;
  RETURN new;
END;
$$;

-- Backfill: temporarily suspend unrelated validation triggers so historical
-- rows that predate current validation rules can still have their timestamp fixed.
ALTER TABLE public.intros_booked DISABLE TRIGGER trg_enforce_member_referral_has_referrer;
ALTER TABLE public.intros_booked DISABLE TRIGGER trg_validate_booking_type_canon;
ALTER TABLE public.intros_booked DISABLE TRIGGER trg_validate_questionnaire_status_canon;

UPDATE public.intros_booked
SET class_start_at = ((class_date::date + intro_time) AT TIME ZONE 'America/Chicago')
WHERE class_date IS NOT NULL
  AND intro_time IS NOT NULL;

ALTER TABLE public.intros_booked ENABLE TRIGGER trg_enforce_member_referral_has_referrer;
ALTER TABLE public.intros_booked ENABLE TRIGGER trg_validate_booking_type_canon;
ALTER TABLE public.intros_booked ENABLE TRIGGER trg_validate_questionnaire_status_canon;
