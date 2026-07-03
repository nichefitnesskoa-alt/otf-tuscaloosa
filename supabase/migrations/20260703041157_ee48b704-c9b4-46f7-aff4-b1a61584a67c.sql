-- Fix SOML tables to work with this app's name-based auth (no supabase.auth session).
-- Existing policies were TO authenticated, which fails silently for anon requests.
-- Match the rest of the app: policies TO public, GRANT to anon+authenticated.

-- soml_config
DROP POLICY IF EXISTS "soml_config_read_all"   ON public.soml_config;
DROP POLICY IF EXISTS "soml_config_update_all" ON public.soml_config;
DROP POLICY IF EXISTS "soml_config_insert_all" ON public.soml_config;
GRANT SELECT, INSERT, UPDATE ON public.soml_config TO anon, authenticated;
CREATE POLICY "soml_config_read_all"   ON public.soml_config FOR SELECT TO public USING (true);
CREATE POLICY "soml_config_update_all" ON public.soml_config FOR UPDATE TO public USING (true) WITH CHECK (true);
CREATE POLICY "soml_config_insert_all" ON public.soml_config FOR INSERT TO public WITH CHECK (true);

-- soml_upgrades
DROP POLICY IF EXISTS "soml_upgrades_read_all"   ON public.soml_upgrades;
DROP POLICY IF EXISTS "soml_upgrades_insert_all" ON public.soml_upgrades;
DROP POLICY IF EXISTS "soml_upgrades_update_all" ON public.soml_upgrades;
DROP POLICY IF EXISTS "soml_upgrades_delete_all" ON public.soml_upgrades;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.soml_upgrades TO anon, authenticated;
CREATE POLICY "soml_upgrades_read_all"   ON public.soml_upgrades FOR SELECT TO public USING (true);
CREATE POLICY "soml_upgrades_insert_all" ON public.soml_upgrades FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "soml_upgrades_update_all" ON public.soml_upgrades FOR UPDATE TO public USING (true) WITH CHECK (true);
CREATE POLICY "soml_upgrades_delete_all" ON public.soml_upgrades FOR DELETE TO public USING (true);

-- soml_manual_referrals
DROP POLICY IF EXISTS "soml_manual_referrals_read_all"   ON public.soml_manual_referrals;
DROP POLICY IF EXISTS "soml_manual_referrals_insert_all" ON public.soml_manual_referrals;
DROP POLICY IF EXISTS "soml_manual_referrals_update_all" ON public.soml_manual_referrals;
DROP POLICY IF EXISTS "soml_manual_referrals_delete_all" ON public.soml_manual_referrals;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.soml_manual_referrals TO anon, authenticated;
CREATE POLICY "soml_manual_referrals_read_all"   ON public.soml_manual_referrals FOR SELECT TO public USING (true);
CREATE POLICY "soml_manual_referrals_insert_all" ON public.soml_manual_referrals FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "soml_manual_referrals_update_all" ON public.soml_manual_referrals FOR UPDATE TO public USING (true) WITH CHECK (true);
CREATE POLICY "soml_manual_referrals_delete_all" ON public.soml_manual_referrals FOR DELETE TO public USING (true);