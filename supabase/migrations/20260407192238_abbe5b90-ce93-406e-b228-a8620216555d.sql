CREATE TABLE public.studio_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key text UNIQUE NOT NULL,
  setting_value text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by text
);

ALTER TABLE public.studio_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read studio settings"
  ON public.studio_settings FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Admins can manage studio settings"
  ON public.studio_settings FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

INSERT INTO public.studio_settings (setting_key, setting_value)
VALUES ('wig_lead_target', '650')
ON CONFLICT (setting_key) DO NOTHING;