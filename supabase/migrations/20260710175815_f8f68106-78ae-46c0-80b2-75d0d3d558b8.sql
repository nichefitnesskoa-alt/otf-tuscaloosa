
CREATE TABLE public.business_partners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  contact_name text,
  contact_info text,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.business_partners TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.business_partners TO anon;
GRANT ALL ON public.business_partners TO service_role;

ALTER TABLE public.business_partners ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read business partners"
  ON public.business_partners FOR SELECT
  USING (true);

CREATE POLICY "Anyone can insert business partners"
  ON public.business_partners FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can update business partners"
  ON public.business_partners FOR UPDATE
  USING (true) WITH CHECK (true);

CREATE TRIGGER update_business_partners_updated_at
  BEFORE UPDATE ON public.business_partners
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.business_partners (name, created_by) VALUES
  ('5 Star Nutrition', 'System'),
  ('Hemline', 'System'),
  ('Turbo Coffee', 'System'),
  ('GB Nutrition', 'System'),
  ('Lush MedSpa', 'System')
ON CONFLICT (name) DO NOTHING;
