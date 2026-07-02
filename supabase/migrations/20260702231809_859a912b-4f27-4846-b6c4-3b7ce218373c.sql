
DROP POLICY IF EXISTS "Authenticated can create intro link codes" ON public.intro_link_codes;
DROP POLICY IF EXISTS "Authenticated can update intro link codes" ON public.intro_link_codes;

GRANT INSERT, UPDATE ON public.intro_link_codes TO anon;

CREATE POLICY "Anyone can create intro link codes"
  ON public.intro_link_codes FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can update intro link codes"
  ON public.intro_link_codes FOR UPDATE
  USING (true) WITH CHECK (true);
