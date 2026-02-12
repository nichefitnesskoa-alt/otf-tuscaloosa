
-- Create churn_log table for AMC churn tracking
CREATE TABLE public.churn_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  churn_count INTEGER NOT NULL,
  effective_date DATE NOT NULL,
  note TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by TEXT
);

-- Enable RLS
ALTER TABLE public.churn_log ENABLE ROW LEVEL SECURITY;

-- RLS policies (same pattern as amc_log)
CREATE POLICY "Allow all read churn_log" ON public.churn_log FOR SELECT USING (true);
CREATE POLICY "Allow all insert churn_log" ON public.churn_log FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all update churn_log" ON public.churn_log FOR UPDATE USING (true);
CREATE POLICY "Allow all delete churn_log" ON public.churn_log FOR DELETE USING (true);
