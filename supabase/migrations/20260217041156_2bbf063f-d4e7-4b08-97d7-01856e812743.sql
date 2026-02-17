
-- Section A: outcome_events audit table with idempotent AMC tracking
CREATE TABLE IF NOT EXISTS public.outcome_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL,
  run_id uuid NULL,
  old_result text,
  new_result text NOT NULL,
  old_booking_status text,
  new_booking_status text,
  edited_by text NOT NULL,
  edited_at timestamptz NOT NULL DEFAULT now(),
  source_component text NOT NULL,
  edit_reason text,
  metadata jsonb DEFAULT '{}'::jsonb
);

ALTER TABLE public.outcome_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all read outcome_events" ON public.outcome_events FOR SELECT USING (true);
CREATE POLICY "Allow all insert outcome_events" ON public.outcome_events FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all update outcome_events" ON public.outcome_events FOR UPDATE USING (true);
CREATE POLICY "Allow all delete outcome_events" ON public.outcome_events FOR DELETE USING (true);

-- Add AMC idempotency columns to intros_run
ALTER TABLE public.intros_run ADD COLUMN IF NOT EXISTS amc_incremented_at timestamptz NULL;
ALTER TABLE public.intros_run ADD COLUMN IF NOT EXISTS amc_incremented_by text NULL;

-- Section E: staff_achievements for gamification
CREATE TABLE IF NOT EXISTS public.staff_achievements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_name text NOT NULL,
  badge_key text NOT NULL,
  earned_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb DEFAULT '{}'::jsonb
);

ALTER TABLE public.staff_achievements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all read staff_achievements" ON public.staff_achievements FOR SELECT USING (true);
CREATE POLICY "Allow all insert staff_achievements" ON public.staff_achievements FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all delete staff_achievements" ON public.staff_achievements FOR DELETE USING (true);
