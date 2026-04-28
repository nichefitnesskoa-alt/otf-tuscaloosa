-- ============================================================
-- 1. ONE-TIME BACKFILL: copy intros_run.coach_name into intros_booked
--    where booking coach is missing/TBD but run has a real coach.
-- ============================================================
WITH src AS (
  SELECT DISTINCT ON (b.id)
    b.id AS booking_id,
    r.coach_name AS run_coach
  FROM public.intros_booked b
  JOIN public.intros_run r ON r.linked_intro_booked_id = b.id
  WHERE b.deleted_at IS NULL
    AND (b.coach_name IS NULL OR btrim(b.coach_name) = '' OR upper(btrim(b.coach_name)) = 'TBD')
    AND r.coach_name IS NOT NULL
    AND btrim(r.coach_name) <> ''
    AND upper(btrim(r.coach_name)) <> 'TBD'
  ORDER BY b.id, r.run_date DESC NULLS LAST, r.created_at DESC
)
UPDATE public.intros_booked b
SET
  coach_name      = src.run_coach,
  last_edited_by  = 'System (Coach Backfill)',
  edit_reason     = 'Backfilled from linked run coach_name',
  last_edited_at  = now()
FROM src
WHERE b.id = src.booking_id;

-- ============================================================
-- 2. TRIGGER FUNCTION: auto-sync booking coach from run coach
--    when booking coach is missing/TBD.
-- ============================================================
CREATE OR REPLACE FUNCTION public.sync_booking_coach_from_run()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only act when the run has a real coach and is linked to a booking
  IF NEW.linked_intro_booked_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.coach_name IS NULL
     OR btrim(NEW.coach_name) = ''
     OR upper(btrim(NEW.coach_name)) = 'TBD' THEN
    RETURN NEW;
  END IF;

  -- Only fill the booking when its coach is missing/TBD — never overwrite a real value
  UPDATE public.intros_booked
  SET
    coach_name     = NEW.coach_name,
    last_edited_by = 'System (Auto-Sync from run)',
    edit_reason    = 'Coach auto-filled from linked intros_run',
    last_edited_at = now()
  WHERE id = NEW.linked_intro_booked_id
    AND deleted_at IS NULL
    AND (coach_name IS NULL OR btrim(coach_name) = '' OR upper(btrim(coach_name)) = 'TBD');

  RETURN NEW;
END;
$$;

-- ============================================================
-- 3. TRIGGER: fires on insert or coach update in intros_run
-- ============================================================
DROP TRIGGER IF EXISTS trg_sync_booking_coach_from_run ON public.intros_run;

CREATE TRIGGER trg_sync_booking_coach_from_run
AFTER INSERT OR UPDATE OF coach_name, linked_intro_booked_id
ON public.intros_run
FOR EACH ROW
EXECUTE FUNCTION public.sync_booking_coach_from_run();