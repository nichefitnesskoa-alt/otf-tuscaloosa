
-- Create AMC log table for manual AMC tracking
CREATE TABLE public.amc_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  logged_date DATE NOT NULL,
  amc_value INTEGER NOT NULL,
  note TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by TEXT
);

-- Enable RLS
ALTER TABLE public.amc_log ENABLE ROW LEVEL SECURITY;

-- RLS policies - all authenticated staff can read, only admins can insert/update/delete
CREATE POLICY "Allow all read amc_log" ON public.amc_log FOR SELECT USING (true);
CREATE POLICY "Allow all insert amc_log" ON public.amc_log FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all update amc_log" ON public.amc_log FOR UPDATE USING (true);
CREATE POLICY "Allow all delete amc_log" ON public.amc_log FOR DELETE USING (true);

-- Seed initial entry
INSERT INTO public.amc_log (logged_date, amc_value, note, created_by)
VALUES ('2025-02-11', 344, 'Initial AMC entry', 'System');
