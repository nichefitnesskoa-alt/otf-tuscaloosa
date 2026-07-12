
CREATE OR REPLACE FUNCTION public.map_run_result_to_booking_status(_result text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE upper(btrim(coalesce(_result,'')))
    WHEN 'PREMIER' THEN 'CLOSED_PURCHASED'
    WHEN 'PREMIER_OTBEAT' THEN 'CLOSED_PURCHASED'
    WHEN 'ELITE' THEN 'CLOSED_PURCHASED'
    WHEN 'BASIC' THEN 'CLOSED_PURCHASED'
    WHEN 'SALE' THEN 'CLOSED_PURCHASED'
    WHEN 'NO_SHOW' THEN 'NO_SHOW'
    WHEN 'DIDNT_BUY' THEN 'ACTIVE'
    WHEN 'NOT_INTERESTED' THEN 'NOT_INTERESTED'
    WHEN 'SECOND_INTRO_SCHEDULED' THEN 'SECOND_INTRO_SCHEDULED'
    WHEN 'FOLLOW_UP_NEEDED' THEN 'FOLLOW_UP_NEEDED'
    WHEN 'PLANNING_2ND_INTRO' THEN 'PLANNING_2ND_INTRO'
    WHEN 'PLANNING_TO_BUY' THEN 'PLANNING_TO_BUY'
    WHEN 'ON_5_CLASS_PACK' THEN 'ON_5_CLASS_PACK'
    WHEN 'PLANNING_RESCHEDULE' THEN 'PLANNING_RESCHEDULE'
    WHEN 'VIP_CLASS_INTRO' THEN 'NOT_INTERESTED'
    WHEN 'DELETED' THEN 'DELETED_SOFT'
    ELSE NULL
  END
$$;

CREATE OR REPLACE FUNCTION public.sync_booking_status_from_run()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_target text; v_current text;
BEGIN
  IF NEW.linked_intro_booked_id IS NULL THEN RETURN NEW; END IF;
  IF NEW.result_canon IS NULL OR btrim(NEW.result_canon) = '' THEN RETURN NEW; END IF;
  IF COALESCE(NEW.ignore_from_metrics, false) THEN RETURN NEW; END IF;
  v_target := public.map_run_result_to_booking_status(NEW.result_canon);
  IF v_target IS NULL THEN RETURN NEW; END IF;
  SELECT booking_status_canon INTO v_current FROM public.intros_booked
    WHERE id = NEW.linked_intro_booked_id AND deleted_at IS NULL;
  IF v_current IS NULL OR v_current = v_target THEN RETURN NEW; END IF;
  IF v_current IN ('DELETED_SOFT','CANCELLED') THEN RETURN NEW; END IF;
  IF v_current = 'CLOSED_PURCHASED' AND v_target <> 'CLOSED_PURCHASED' THEN RETURN NEW; END IF;
  UPDATE public.intros_booked
  SET booking_status_canon = v_target,
      booking_status = CASE v_target
        WHEN 'NO_SHOW' THEN 'No-show'
        WHEN 'CLOSED_PURCHASED' THEN 'Closed – Bought'
        WHEN 'NOT_INTERESTED' THEN 'Not Interested'
        WHEN 'SECOND_INTRO_SCHEDULED' THEN '2nd Intro Scheduled'
        WHEN 'FOLLOW_UP_NEEDED' THEN 'Follow-up needed'
        WHEN 'PLANNING_2ND_INTRO' THEN 'Planning to Book 2nd Intro'
        WHEN 'PLANNING_TO_BUY' THEN 'Planning to buy'
        WHEN 'ON_5_CLASS_PACK' THEN 'On 5 Class Pack'
        WHEN 'PLANNING_RESCHEDULE' THEN 'Planning to Reschedule'
        ELSE booking_status
      END,
      last_edited_at = now(),
      last_edited_by = COALESCE(NULLIF(last_edited_by,''), 'System (canon sync from run)'),
      edit_reason = 'Auto-sync booking_status_canon from resolved intros_run.result_canon'
  WHERE id = NEW.linked_intro_booked_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_booking_status_from_run ON public.intros_run;
CREATE TRIGGER trg_sync_booking_status_from_run
AFTER INSERT OR UPDATE OF result_canon, linked_intro_booked_id, ignore_from_metrics
ON public.intros_run FOR EACH ROW EXECUTE FUNCTION public.sync_booking_status_from_run();

-- Backfill: bypass the referral-name enforcement trigger (some pre-existing rows violate it
-- with legacy blank referred_by_member_name and would block canon repair). We only touch
-- canon status columns; the referral fields are unchanged.
ALTER TABLE public.intros_booked DISABLE TRIGGER trg_enforce_member_referral_has_referrer;

UPDATE public.intros_booked b
SET booking_status_canon = public.map_run_result_to_booking_status(r.result_canon),
    booking_status = CASE public.map_run_result_to_booking_status(r.result_canon)
      WHEN 'NO_SHOW' THEN 'No-show'
      WHEN 'CLOSED_PURCHASED' THEN 'Closed – Bought'
      WHEN 'NOT_INTERESTED' THEN 'Not Interested'
      WHEN 'SECOND_INTRO_SCHEDULED' THEN '2nd Intro Scheduled'
      WHEN 'FOLLOW_UP_NEEDED' THEN 'Follow-up needed'
      WHEN 'PLANNING_2ND_INTRO' THEN 'Planning to Book 2nd Intro'
      WHEN 'PLANNING_TO_BUY' THEN 'Planning to buy'
      WHEN 'ON_5_CLASS_PACK' THEN 'On 5 Class Pack'
      WHEN 'PLANNING_RESCHEDULE' THEN 'Planning to Reschedule'
      ELSE b.booking_status
    END,
    last_edited_at = now(),
    last_edited_by = 'System (backfill canon sync)',
    edit_reason = 'Backfill: booking_status_canon repaired to match resolved intros_run.result_canon'
FROM public.intros_run r
WHERE r.linked_intro_booked_id = b.id
  AND b.deleted_at IS NULL
  AND b.booking_status_canon = 'ACTIVE'
  AND r.result_canon IS NOT NULL
  AND COALESCE(r.ignore_from_metrics, false) = false
  AND public.map_run_result_to_booking_status(r.result_canon) IS NOT NULL
  AND public.map_run_result_to_booking_status(r.result_canon) <> 'ACTIVE';

ALTER TABLE public.intros_booked ENABLE TRIGGER trg_enforce_member_referral_has_referrer;
