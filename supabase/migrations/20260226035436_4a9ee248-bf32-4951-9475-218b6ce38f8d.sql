CREATE TABLE IF NOT EXISTS public.studio_intelligence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_date date NOT NULL UNIQUE,
  content_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.studio_intelligence ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read studio_intelligence" ON public.studio_intelligence FOR SELECT USING (true);
CREATE POLICY "Authenticated can insert studio_intelligence" ON public.studio_intelligence FOR INSERT WITH CHECK (true);
CREATE POLICY "Authenticated can update studio_intelligence" ON public.studio_intelligence FOR UPDATE USING (true);
CREATE POLICY "Authenticated can delete studio_intelligence" ON public.studio_intelligence FOR DELETE USING (true);