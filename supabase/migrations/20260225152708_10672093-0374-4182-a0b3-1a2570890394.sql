
-- Auto-create an intro_questionnaires row with a human-readable slug
-- whenever a new intros_booked record is inserted (non-VIP, non-COMP).
CREATE OR REPLACE FUNCTION public.auto_create_questionnaire()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_first text;
  v_last text;
  v_slug text;
  v_existing uuid;
BEGIN
  -- Only for standard bookings, not VIP/COMP
  IF NEW.booking_type_canon IN ('VIP', 'COMP') THEN
    RETURN NEW;
  END IF;

  -- Skip 2nd intros (rebooked or originating)
  IF NEW.originating_booking_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Check if questionnaire already exists for this booking
  SELECT id INTO v_existing
  FROM public.intro_questionnaires
  WHERE booking_id = NEW.id
  LIMIT 1;

  IF v_existing IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Parse name
  v_first := split_part(NEW.member_name, ' ', 1);
  v_last := CASE
    WHEN position(' ' in NEW.member_name) > 0
    THEN substring(NEW.member_name from position(' ' in NEW.member_name) + 1)
    ELSE ''
  END;

  -- Build slug: firstname-lastname-MonDD
  v_slug := regexp_replace(lower(v_first), '[^a-z0-9]', '', 'g')
    || '-' || regexp_replace(lower(v_last), '[^a-z0-9]', '', 'g')
    || '-' || lower(to_char(NEW.class_date, 'MonDD'));

  -- Deduplicate slug
  IF EXISTS (SELECT 1 FROM public.intro_questionnaires WHERE slug = v_slug) THEN
    v_slug := v_slug || '-' || substring(NEW.id::text from 1 for 8);
  END IF;

  -- Insert questionnaire
  INSERT INTO public.intro_questionnaires (
    booking_id,
    client_first_name,
    client_last_name,
    scheduled_class_date,
    scheduled_class_time,
    slug,
    status
  ) VALUES (
    NEW.id,
    v_first,
    v_last,
    NEW.class_date,
    NEW.intro_time,
    v_slug,
    'not_sent'
  );

  -- Update the booking's questionnaire_link field
  UPDATE public.intros_booked
  SET questionnaire_link = 'https://otf-tuscaloosa.lovable.app/q/' || v_slug
  WHERE id = NEW.id;

  RETURN NEW;
END;
$function$;

-- Create the trigger
DROP TRIGGER IF EXISTS trg_auto_create_questionnaire ON public.intros_booked;
CREATE TRIGGER trg_auto_create_questionnaire
  AFTER INSERT ON public.intros_booked
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_create_questionnaire();
