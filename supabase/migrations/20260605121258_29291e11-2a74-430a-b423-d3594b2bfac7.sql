-- Auto-link self-sourced lead to a new booking when phones match.
-- When an intros_booked row is inserted and a self-sourced lead exists with the
-- same normalized phone (last 10 digits), link the lead to the booking and move
-- it to the 'booked' stage. This honors the existing dedup rule (lead row wins,
-- booking is skipped in Leads count) so the person counts ONCE in Leads and
-- ONCE in Booked, never twice in either.

CREATE OR REPLACE FUNCTION public.auto_link_self_sourced_lead_to_booking()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_digits text;
  v_lead_id uuid;
BEGIN
  IF NEW.phone IS NULL OR btrim(NEW.phone) = '' THEN
    RETURN NEW;
  END IF;

  v_digits := regexp_replace(NEW.phone, '\D', '', 'g');
  IF length(v_digits) < 10 THEN
    RETURN NEW;
  END IF;
  v_digits := right(v_digits, 10);

  -- Find an existing self-sourced lead with matching last-10 phone
  -- that is not already linked to a booking.
  SELECT id INTO v_lead_id
  FROM public.leads
  WHERE sourced_by_sa IS NOT NULL
    AND booked_intro_id IS NULL
    AND phone IS NOT NULL
    AND right(regexp_replace(phone, '\D', '', 'g'), 10) = v_digits
  ORDER BY created_at ASC
  LIMIT 1;

  IF v_lead_id IS NULL THEN
    RETURN NEW;
  END IF;

  UPDATE public.leads
  SET booked_intro_id = NEW.id,
      stage = 'booked',
      updated_at = now()
  WHERE id = v_lead_id;

  INSERT INTO public.lead_activities (lead_id, activity_type, performed_by, notes)
  VALUES (
    v_lead_id,
    'stage_change',
    'System (auto-link self-sourced)',
    'Auto-linked to booking on phone match'
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_link_self_sourced_lead ON public.intros_booked;
CREATE TRIGGER trg_auto_link_self_sourced_lead
AFTER INSERT ON public.intros_booked
FOR EACH ROW
EXECUTE FUNCTION public.auto_link_self_sourced_lead_to_booking();