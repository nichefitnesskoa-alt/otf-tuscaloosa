
CREATE TABLE public.coaching_scripts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  format text NOT NULL,
  script_date date NOT NULL,
  file_url text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.coaching_scripts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read coaching_scripts"
  ON public.coaching_scripts FOR SELECT TO public
  USING (true);

CREATE POLICY "Admin can insert coaching_scripts"
  ON public.coaching_scripts FOR INSERT TO public
  WITH CHECK (true);

CREATE POLICY "Admin can update coaching_scripts"
  ON public.coaching_scripts FOR UPDATE TO public
  USING (true);

CREATE POLICY "Admin can delete coaching_scripts"
  ON public.coaching_scripts FOR DELETE TO public
  USING (true);

INSERT INTO storage.buckets (id, name, public)
VALUES ('coaching-scripts', 'coaching-scripts', true);

CREATE POLICY "Anyone can read coaching-scripts"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'coaching-scripts');

CREATE POLICY "Authenticated can upload coaching-scripts"
  ON storage.objects FOR INSERT TO public
  WITH CHECK (bucket_id = 'coaching-scripts');

CREATE POLICY "Authenticated can delete coaching-scripts"
  ON storage.objects FOR DELETE TO public
  USING (bucket_id = 'coaching-scripts');
