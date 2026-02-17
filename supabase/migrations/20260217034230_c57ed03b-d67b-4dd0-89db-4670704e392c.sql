
CREATE TABLE IF NOT EXISTS public.outcome_changes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  booking_id text NOT NULL,
  run_id text,
  old_result text,
  new_result text NOT NULL,
  old_booking_status text,
  new_booking_status text,
  changed_by text NOT NULL,
  changed_at timestamptz DEFAULT now(),
  change_reason text,
  source_component text NOT NULL,
  amc_incremented boolean DEFAULT false
);

ALTER TABLE public.outcome_changes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all insert outcome_changes" ON public.outcome_changes FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all read outcome_changes" ON public.outcome_changes FOR SELECT USING (true);
CREATE POLICY "Allow all update outcome_changes" ON public.outcome_changes FOR UPDATE USING (true);
CREATE POLICY "Allow all delete outcome_changes" ON public.outcome_changes FOR DELETE USING (true);
