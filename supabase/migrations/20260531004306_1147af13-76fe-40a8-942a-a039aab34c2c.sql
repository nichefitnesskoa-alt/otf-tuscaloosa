-- Allow studio_settings writes from the app's name-based auth (anon role).
-- The app does not use Supabase Auth, so the prior "authenticated"-scoped
-- policies silently blocked updates from PostgREST (0 rows affected, no error).
DROP POLICY IF EXISTS "Admins can manage studio settings" ON public.studio_settings;
DROP POLICY IF EXISTS "Anyone can read studio settings" ON public.studio_settings;

CREATE POLICY "Allow all read studio_settings"
  ON public.studio_settings FOR SELECT TO public USING (true);

CREATE POLICY "Allow all insert studio_settings"
  ON public.studio_settings FOR INSERT TO public WITH CHECK (true);

CREATE POLICY "Allow all update studio_settings"
  ON public.studio_settings FOR UPDATE TO public USING (true) WITH CHECK (true);

CREATE POLICY "Allow all delete studio_settings"
  ON public.studio_settings FOR DELETE TO public USING (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.studio_settings TO anon, authenticated;
GRANT ALL ON public.studio_settings TO service_role;