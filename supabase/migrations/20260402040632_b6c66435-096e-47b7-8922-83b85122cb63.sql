
CREATE TABLE public.daily_lead_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  log_date date NOT NULL DEFAULT CURRENT_DATE,
  lead_count integer NOT NULL,
  logged_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (log_date)
);

ALTER TABLE public.daily_lead_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all read daily_lead_log" ON public.daily_lead_log FOR SELECT TO public USING (true);
CREATE POLICY "Allow all insert daily_lead_log" ON public.daily_lead_log FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Allow all update daily_lead_log" ON public.daily_lead_log FOR UPDATE TO public USING (true);
CREATE POLICY "Allow all delete daily_lead_log" ON public.daily_lead_log FOR DELETE TO public USING (true);

CREATE TRIGGER update_daily_lead_log_updated_at
  BEFORE UPDATE ON public.daily_lead_log
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
