
-- Add is_legacy flag for backfilled records
ALTER TABLE public.follow_up_queue ADD COLUMN IF NOT EXISTS is_legacy boolean NOT NULL DEFAULT false;

-- Add index for My Day query optimization
CREATE INDEX IF NOT EXISTS idx_follow_up_queue_status_date ON public.follow_up_queue (status, scheduled_date);
CREATE INDEX IF NOT EXISTS idx_follow_up_queue_person ON public.follow_up_queue (person_name);
