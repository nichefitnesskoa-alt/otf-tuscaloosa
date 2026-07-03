
-- =====================================================================
-- Part A: Enforce referring member on Member Referral bookings
-- =====================================================================
CREATE OR REPLACE FUNCTION public.enforce_member_referral_has_referrer()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.lead_source IN ('Member Referral', 'Member Referral (5 class pack)')
     AND (NEW.referred_by_member_name IS NULL OR btrim(NEW.referred_by_member_name) = '') THEN
    RAISE EXCEPTION 'Member Referral bookings require a referring member name (referred_by_member_name).';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_member_referral_has_referrer ON public.intros_booked;
CREATE TRIGGER trg_enforce_member_referral_has_referrer
BEFORE INSERT OR UPDATE ON public.intros_booked
FOR EACH ROW
EXECUTE FUNCTION public.enforce_member_referral_has_referrer();

-- =====================================================================
-- Part B: soml_config (singleton row)
-- =====================================================================
CREATE TABLE public.soml_config (
  id INT PRIMARY KEY DEFAULT 1,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  referrals_goal INT NOT NULL DEFAULT 0,
  upgrades_goal INT NOT NULL DEFAULT 0,
  sales_goal INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by TEXT,
  CONSTRAINT soml_config_singleton CHECK (id = 1)
);

GRANT SELECT, INSERT, UPDATE ON public.soml_config TO authenticated;
GRANT ALL ON public.soml_config TO service_role;

ALTER TABLE public.soml_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "soml_config_read_all" ON public.soml_config FOR SELECT TO authenticated USING (true);
CREATE POLICY "soml_config_update_all" ON public.soml_config FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "soml_config_insert_all" ON public.soml_config FOR INSERT TO authenticated WITH CHECK (true);

-- Seed the July 2026 window (all of July per user)
INSERT INTO public.soml_config (id, start_date, end_date, referrals_goal, upgrades_goal, sales_goal, updated_by)
VALUES (1, DATE '2026-07-01', DATE '2026-07-31', 0, 0, 0, 'system')
ON CONFLICT (id) DO NOTHING;

CREATE TRIGGER trg_soml_config_updated_at
BEFORE UPDATE ON public.soml_config
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================================
-- Part C: soml_upgrades (manual log)
-- =====================================================================
CREATE TABLE public.soml_upgrades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_name TEXT NOT NULL,
  upgraded_by TEXT NOT NULL,
  upgraded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes TEXT,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.soml_upgrades TO authenticated;
GRANT ALL ON public.soml_upgrades TO service_role;

ALTER TABLE public.soml_upgrades ENABLE ROW LEVEL SECURITY;

CREATE POLICY "soml_upgrades_read_all" ON public.soml_upgrades FOR SELECT TO authenticated USING (true);
CREATE POLICY "soml_upgrades_insert_all" ON public.soml_upgrades FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "soml_upgrades_update_all" ON public.soml_upgrades FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "soml_upgrades_delete_all" ON public.soml_upgrades FOR DELETE TO authenticated USING (true);

CREATE INDEX idx_soml_upgrades_upgraded_at ON public.soml_upgrades (upgraded_at);
CREATE INDEX idx_soml_upgrades_upgraded_by ON public.soml_upgrades (upgraded_by);

-- =====================================================================
-- Part D: soml_manual_referrals (backup log)
-- =====================================================================
CREATE TABLE public.soml_manual_referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_name TEXT NOT NULL,
  referred_by TEXT NOT NULL,
  referred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes TEXT,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.soml_manual_referrals TO authenticated;
GRANT ALL ON public.soml_manual_referrals TO service_role;

ALTER TABLE public.soml_manual_referrals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "soml_manual_referrals_read_all" ON public.soml_manual_referrals FOR SELECT TO authenticated USING (true);
CREATE POLICY "soml_manual_referrals_insert_all" ON public.soml_manual_referrals FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "soml_manual_referrals_update_all" ON public.soml_manual_referrals FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "soml_manual_referrals_delete_all" ON public.soml_manual_referrals FOR DELETE TO authenticated USING (true);

CREATE INDEX idx_soml_manual_referrals_referred_at ON public.soml_manual_referrals (referred_at);
CREATE INDEX idx_soml_manual_referrals_referred_by ON public.soml_manual_referrals (referred_by);
