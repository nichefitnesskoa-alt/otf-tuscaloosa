
-- SOML pending referrals: visible book-time tracking that realizes on sale.
-- ADDITIVE ONLY. Does not change existing referral count logic.

CREATE TABLE IF NOT EXISTS public.soml_pending_referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL UNIQUE REFERENCES public.intros_booked(id) ON DELETE CASCADE,
  referring_member text NOT NULL,
  credited_sa text NOT NULL,
  state text NOT NULL DEFAULT 'pending' CHECK (state IN ('pending','realized','not_converted')),
  resolved_outcome text,
  realized_at date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_soml_pending_referrals_credited_sa ON public.soml_pending_referrals(credited_sa);
CREATE INDEX IF NOT EXISTS idx_soml_pending_referrals_state ON public.soml_pending_referrals(state);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.soml_pending_referrals TO authenticated;
GRANT SELECT ON public.soml_pending_referrals TO anon;
GRANT ALL ON public.soml_pending_referrals TO service_role;

ALTER TABLE public.soml_pending_referrals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read pending referrals"
  ON public.soml_pending_referrals FOR SELECT USING (true);
CREATE POLICY "Anyone can insert pending referrals"
  ON public.soml_pending_referrals FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update pending referrals"
  ON public.soml_pending_referrals FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete pending referrals"
  ON public.soml_pending_referrals FOR DELETE USING (true);

CREATE TRIGGER trg_soml_pending_referrals_updated_at
  BEFORE UPDATE ON public.soml_pending_referrals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.soml_pending_referrals;

-- Trigger 1: booking insert -> create pending row
CREATE OR REPLACE FUNCTION public.soml_create_pending_referral()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_credit text;
BEGIN
  IF NEW.lead_source NOT IN ('Member Referral','Member Referral (5 class pack)') THEN
    RETURN NEW;
  END IF;
  IF NEW.referred_by_member_name IS NULL OR btrim(NEW.referred_by_member_name) = '' THEN
    RETURN NEW;
  END IF;

  v_credit := NEW.booked_by;
  IF v_credit IS NULL OR btrim(v_credit) = '' OR v_credit IN ('Self booked','Self-booked','System','system') THEN
    v_credit := NEW.intro_owner;
  END IF;
  IF v_credit IS NULL OR btrim(v_credit) = '' THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.soml_pending_referrals (booking_id, referring_member, credited_sa, state)
  VALUES (NEW.id, btrim(NEW.referred_by_member_name), v_credit, 'pending')
  ON CONFLICT (booking_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_soml_pending_referral_on_booking ON public.intros_booked;
CREATE TRIGGER trg_soml_pending_referral_on_booking
  AFTER INSERT ON public.intros_booked
  FOR EACH ROW EXECUTE FUNCTION public.soml_create_pending_referral();

-- Trigger 2: run insert/update -> resolve pending row
CREATE OR REPLACE FUNCTION public.soml_resolve_pending_referral()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_pending_id uuid;
  v_current_state text;
  v_result text;
  v_sale_canons text[] := ARRAY['SALE','PREMIER','PREMIER_OTBEAT','ELITE','BASIC'];
BEGIN
  IF NEW.linked_intro_booked_id IS NULL THEN RETURN NEW; END IF;
  IF NEW.ignore_from_metrics THEN RETURN NEW; END IF;

  SELECT id, state INTO v_pending_id, v_current_state
  FROM public.soml_pending_referrals
  WHERE booking_id = NEW.linked_intro_booked_id
  LIMIT 1;
  IF v_pending_id IS NULL THEN RETURN NEW; END IF;

  v_result := upper(btrim(COALESCE(NEW.result_canon,'')));

  IF v_result = ANY(v_sale_canons) THEN
    UPDATE public.soml_pending_referrals
      SET state='realized',
          realized_at = COALESCE(NEW.buy_date, (now() AT TIME ZONE 'America/Chicago')::date),
          resolved_outcome = v_result
      WHERE id = v_pending_id AND state <> 'realized';
  ELSIF v_result IN ('NOT_INTERESTED','DELETED') THEN
    -- Only mark not_converted if not already realized
    UPDATE public.soml_pending_referrals
      SET state='not_converted',
          resolved_outcome = v_result,
          realized_at = NULL
      WHERE id = v_pending_id AND state = 'pending';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_soml_resolve_pending_on_run ON public.intros_run;
CREATE TRIGGER trg_soml_resolve_pending_on_run
  AFTER INSERT OR UPDATE OF result_canon, buy_date, ignore_from_metrics ON public.intros_run
  FOR EACH ROW EXECUTE FUNCTION public.soml_resolve_pending_referral();

-- Backfill from existing Member Referral bookings
INSERT INTO public.soml_pending_referrals (booking_id, referring_member, credited_sa, state, resolved_outcome, realized_at)
SELECT
  b.id,
  btrim(b.referred_by_member_name),
  COALESCE(
    NULLIF(CASE WHEN b.booked_by IN ('Self booked','Self-booked','System','system') THEN NULL ELSE b.booked_by END, ''),
    b.intro_owner
  ) AS credit,
  CASE
    WHEN EXISTS (
      SELECT 1 FROM public.intros_run r
      WHERE r.linked_intro_booked_id = b.id
        AND upper(btrim(COALESCE(r.result_canon,''))) IN ('SALE','PREMIER','PREMIER_OTBEAT','ELITE','BASIC')
        AND COALESCE(r.ignore_from_metrics,false) = false
    ) THEN 'realized'
    WHEN EXISTS (
      SELECT 1 FROM public.intros_run r
      WHERE r.linked_intro_booked_id = b.id
        AND upper(btrim(COALESCE(r.result_canon,''))) IN ('NOT_INTERESTED','DELETED')
    ) THEN 'not_converted'
    ELSE 'pending'
  END,
  (
    SELECT upper(btrim(COALESCE(r.result_canon,'')))
    FROM public.intros_run r
    WHERE r.linked_intro_booked_id = b.id
      AND upper(btrim(COALESCE(r.result_canon,''))) IN ('SALE','PREMIER','PREMIER_OTBEAT','ELITE','BASIC','NOT_INTERESTED','DELETED')
    ORDER BY r.created_at DESC LIMIT 1
  ),
  (
    SELECT COALESCE(r.buy_date, r.run_date, r.created_at::date)
    FROM public.intros_run r
    WHERE r.linked_intro_booked_id = b.id
      AND upper(btrim(COALESCE(r.result_canon,''))) IN ('SALE','PREMIER','PREMIER_OTBEAT','ELITE','BASIC')
      AND COALESCE(r.ignore_from_metrics,false) = false
    ORDER BY r.buy_date DESC NULLS LAST LIMIT 1
  )
FROM public.intros_booked b
WHERE b.lead_source IN ('Member Referral','Member Referral (5 class pack)')
  AND b.referred_by_member_name IS NOT NULL
  AND btrim(b.referred_by_member_name) <> ''
  AND b.deleted_at IS NULL
  AND COALESCE(
    NULLIF(CASE WHEN b.booked_by IN ('Self booked','Self-booked','System','system') THEN NULL ELSE b.booked_by END, ''),
    b.intro_owner
  ) IS NOT NULL
ON CONFLICT (booking_id) DO NOTHING;
