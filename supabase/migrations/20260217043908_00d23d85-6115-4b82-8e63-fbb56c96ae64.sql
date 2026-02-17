
-- Section 1: Add canonical status columns to intros_booked and intros_run
ALTER TABLE public.intros_booked
  ADD COLUMN IF NOT EXISTS booking_status_canon text NOT NULL DEFAULT 'ACTIVE';

ALTER TABLE public.intros_run
  ADD COLUMN IF NOT EXISTS result_canon text NOT NULL DEFAULT 'UNRESOLVED';

-- Backfill booking_status_canon from legacy booking_status
UPDATE public.intros_booked SET booking_status_canon = CASE
  WHEN lower(trim(booking_status)) IN ('active', 'unscheduled') THEN 'ACTIVE'
  WHEN lower(trim(booking_status)) IN ('closed – bought', 'closed - bought', 'closed bought', 'closed (purchased)', 'closed_purchased') THEN 'CLOSED_PURCHASED'
  WHEN lower(trim(booking_status)) IN ('not interested', 'not_interested') THEN 'NOT_INTERESTED'
  WHEN lower(trim(booking_status)) IN ('2nd intro scheduled', 'second_intro_scheduled') THEN 'SECOND_INTRO_SCHEDULED'
  WHEN lower(trim(booking_status)) IN ('no show', 'no-show', 'no_show') THEN 'NO_SHOW'
  WHEN lower(trim(booking_status)) IN ('cancelled', 'canceled') THEN 'CANCELLED'
  WHEN lower(trim(booking_status)) IN ('deleted (soft)', 'deleted_soft') THEN 'DELETED_SOFT'
  ELSE 'ACTIVE'
END
WHERE booking_status IS NOT NULL;

-- Backfill result_canon from legacy result
UPDATE public.intros_run SET result_canon = CASE
  WHEN lower(trim(result)) IN ('no-show', 'no show', 'no_show') THEN 'NO_SHOW'
  WHEN lower(trim(result)) IN ('didn''t buy', 'didnt_buy', 'didnt buy') THEN 'DIDNT_BUY'
  WHEN lower(trim(result)) IN ('not interested', 'not_interested') THEN 'NOT_INTERESTED'
  WHEN lower(trim(result)) IN ('follow-up needed', 'follow_up_needed') THEN 'FOLLOW_UP_NEEDED'
  WHEN lower(trim(result)) IN ('booked 2nd intro', 'second_intro_scheduled') THEN 'SECOND_INTRO_SCHEDULED'
  WHEN lower(trim(result)) LIKE '%premier%' THEN 'PREMIER'
  WHEN lower(trim(result)) LIKE '%elite%' THEN 'ELITE'
  WHEN lower(trim(result)) LIKE '%basic%' THEN 'BASIC'
  WHEN lower(trim(result)) IN ('unresolved', '') OR result IS NULL THEN 'UNRESOLVED'
  ELSE 'UNRESOLVED'
END;

-- Section 3: Add rebook tracking columns to intros_booked
ALTER TABLE public.intros_booked
  ADD COLUMN IF NOT EXISTS rebooked_from_booking_id uuid NULL,
  ADD COLUMN IF NOT EXISTS rebook_reason text NULL,
  ADD COLUMN IF NOT EXISTS rebooked_at timestamptz NULL;

-- Add rebook tracking to follow_up_queue
ALTER TABLE public.follow_up_queue
  ADD COLUMN IF NOT EXISTS saved_to_rebook boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS saved_to_rebook_at timestamptz NULL;

-- Index for rebook queries
CREATE INDEX IF NOT EXISTS idx_intros_booked_rebooked_from ON public.intros_booked(rebooked_from_booking_id) WHERE rebooked_from_booking_id IS NOT NULL;

-- Index for canon column queries
CREATE INDEX IF NOT EXISTS idx_intros_booked_status_canon ON public.intros_booked(booking_status_canon);
CREATE INDEX IF NOT EXISTS idx_intros_run_result_canon ON public.intros_run(result_canon);
