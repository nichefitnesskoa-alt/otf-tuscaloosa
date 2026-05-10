
CREATE TABLE public.shift_coverage_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sa_name text NOT NULL,
  shift_date date NOT NULL,
  shift_type text NOT NULL,
  milestones_celebrated integer NOT NULL DEFAULT 0 CHECK (milestones_celebrated >= 0),
  milestones_missed integer NOT NULL DEFAULT 0 CHECK (milestones_missed >= 0),
  notes text,
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (sa_name, shift_date, shift_type)
);

ALTER TABLE public.shift_coverage_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all read shift_coverage_reports" ON public.shift_coverage_reports FOR SELECT USING (true);
CREATE POLICY "Allow all insert shift_coverage_reports" ON public.shift_coverage_reports FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all update shift_coverage_reports" ON public.shift_coverage_reports FOR UPDATE USING (true);
CREATE POLICY "Allow all delete shift_coverage_reports" ON public.shift_coverage_reports FOR DELETE USING (true);

CREATE TRIGGER trg_shift_coverage_reports_updated_at
BEFORE UPDATE ON public.shift_coverage_reports
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_shift_coverage_reports_sa_date
  ON public.shift_coverage_reports (sa_name, shift_date);
