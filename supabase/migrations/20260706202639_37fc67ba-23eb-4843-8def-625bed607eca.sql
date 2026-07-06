CREATE OR REPLACE FUNCTION public.sync_booking_on_questionnaire_submit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.booking_id IS NULL THEN RETURN NEW; END IF;
  IF (NEW.status IN ('completed','submitted'))
     AND (OLD.status IS DISTINCT FROM NEW.status
          OR (OLD.submitted_at IS NULL AND NEW.submitted_at IS NOT NULL)) THEN
    UPDATE public.intros_booked
       SET questionnaire_status_canon = 'completed',
           questionnaire_completed_at = COALESCE(NEW.submitted_at, now())
     WHERE id = NEW.booking_id
       AND (questionnaire_status_canon IS DISTINCT FROM 'completed'
            OR questionnaire_completed_at IS NULL);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_booking_on_questionnaire_submit ON public.intro_questionnaires;
CREATE TRIGGER trg_sync_booking_on_questionnaire_submit
AFTER UPDATE ON public.intro_questionnaires
FOR EACH ROW
EXECUTE FUNCTION public.sync_booking_on_questionnaire_submit();

-- Backfill: skip rows that would trip the member-referral guard.
UPDATE public.intros_booked b
SET questionnaire_status_canon = 'completed',
    questionnaire_completed_at = COALESCE(b.questionnaire_completed_at, q.submitted_at)
FROM public.intro_questionnaires q
WHERE q.booking_id = b.id
  AND q.status IN ('completed','submitted')
  AND b.questionnaire_status_canon <> 'completed'
  AND (b.lead_source NOT IN ('Member Referral','Member Referral (5 class pack)')
       OR (b.referred_by_member_name IS NOT NULL AND btrim(b.referred_by_member_name) <> ''));

UPDATE public.intros_booked b
SET questionnaire_status_canon = 'sent',
    questionnaire_sent_at = COALESCE(b.questionnaire_sent_at, q.last_opened_at, q.created_at)
FROM public.intro_questionnaires q
WHERE q.booking_id = b.id
  AND q.last_opened_at IS NOT NULL
  AND q.status NOT IN ('completed','submitted')
  AND b.questionnaire_status_canon = 'not_sent'
  AND (b.lead_source NOT IN ('Member Referral','Member Referral (5 class pack)')
       OR (b.referred_by_member_name IS NOT NULL AND btrim(b.referred_by_member_name) <> ''));