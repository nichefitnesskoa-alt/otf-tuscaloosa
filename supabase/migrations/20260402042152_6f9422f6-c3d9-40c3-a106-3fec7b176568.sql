
CREATE TABLE public.monthly_lead_totals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  month_year text NOT NULL,
  lead_total integer NOT NULL DEFAULT 0,
  last_updated_by text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (month_year)
);

ALTER TABLE public.monthly_lead_totals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all read monthly_lead_totals" ON public.monthly_lead_totals FOR SELECT TO public USING (true);
CREATE POLICY "Allow all insert monthly_lead_totals" ON public.monthly_lead_totals FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Allow all update monthly_lead_totals" ON public.monthly_lead_totals FOR UPDATE TO public USING (true);
CREATE POLICY "Allow all delete monthly_lead_totals" ON public.monthly_lead_totals FOR DELETE TO public USING (true);

CREATE INDEX IF NOT EXISTS idx_intros_run_coach_name ON public.intros_run (coach_name);
CREATE INDEX IF NOT EXISTS idx_intros_booked_class_date ON public.intros_booked (class_date);
CREATE INDEX IF NOT EXISTS idx_milestones_created_at ON public.milestones (created_at);
