-- Fix SOML pending referral chain handling.
-- Problem: reschedules of a referred intro created duplicate pending rows credited to
-- the SA who booked the reschedule, not the SA who booked the original chain root.
-- Brent Rogers case: Zoe booked the Jun 23 original; Koa rebooked Jul 3 reschedule;
-- sale closed on Jul 3 realized to Koa. Credit belongs to Zoe (chain root booker).

-- Helper: walk originating_booking_id chain to the root.
CREATE OR REPLACE FUNCTION public.soml_chain_root_booking_id(_booking_id uuid)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_current uuid := _booking_id;
  v_parent  uuid;
  v_hops    int  := 0;
BEGIN
  LOOP
    SELECT originating_booking_id INTO v_parent
      FROM public.intros_booked
      WHERE id = v_current;
    IF v_parent IS NULL THEN
      RETURN v_current;
    END IF;
    v_current := v_parent;
    v_hops := v_hops + 1;
    IF v_hops > 20 THEN
      RETURN v_current; -- cycle guard
    END IF;
  END LOOP;
END;
$$;

-- Create-pending trigger: dedupe by chain root, credit the SA who booked the root.
CREATE OR REPLACE FUNCTION public.soml_create_pending_referral()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_credit    text;
  v_root_id   uuid;
  v_root      record;
  v_existing  uuid;
BEGIN
  IF NEW.lead_source NOT IN ('Member Referral','Member Referral (5 class pack)') THEN
    RETURN NEW;
  END IF;
  IF NEW.referred_by_member_name IS NULL OR btrim(NEW.referred_by_member_name) = '' THEN
    RETURN NEW;
  END IF;

  -- Resolve to chain root so reschedules do not create duplicate pending rows.
  v_root_id := public.soml_chain_root_booking_id(NEW.id);

  -- If any pending row already exists anywhere in this chain, do nothing.
  SELECT p.id INTO v_existing
  FROM public.soml_pending_referrals p
  JOIN public.intros_booked b ON b.id = p.booking_id
  WHERE public.soml_chain_root_booking_id(p.booking_id) = v_root_id
  LIMIT 1;
  IF v_existing IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Load root booking to prefer its booked_by / intro_owner for credit.
  SELECT id, booked_by, intro_owner, referred_by_member_name
    INTO v_root
    FROM public.intros_booked
    WHERE id = v_root_id;

  v_credit := v_root.booked_by;
  IF v_credit IS NULL OR btrim(v_credit) = '' OR v_credit IN ('Self booked','Self-booked','System','system') THEN
    v_credit := v_root.intro_owner;
  END IF;
  IF v_credit IS NULL OR btrim(v_credit) = '' THEN
    -- fall back to the current booking's booker if root has none
    v_credit := NEW.booked_by;
    IF v_credit IS NULL OR btrim(v_credit) = '' OR v_credit IN ('Self booked','Self-booked','System','system') THEN
      v_credit := NEW.intro_owner;
    END IF;
  END IF;
  IF v_credit IS NULL OR btrim(v_credit) = '' THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.soml_pending_referrals (booking_id, referring_member, credited_sa, state)
  VALUES (v_root_id,
          btrim(COALESCE(v_root.referred_by_member_name, NEW.referred_by_member_name)),
          v_credit,
          'pending')
  ON CONFLICT (booking_id) DO NOTHING;

  RETURN NEW;
END;
$function$;

-- Resolve trigger: find pending row anywhere in the chain, not just the exact booking.
CREATE OR REPLACE FUNCTION public.soml_resolve_pending_referral()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_pending_id uuid;
  v_current_state text;
  v_result text;
  v_root_id uuid;
  v_sale_canons text[] := ARRAY['SALE','PREMIER','PREMIER_OTBEAT','ELITE','BASIC'];
BEGIN
  IF NEW.linked_intro_booked_id IS NULL THEN RETURN NEW; END IF;
  IF NEW.ignore_from_metrics THEN RETURN NEW; END IF;

  v_root_id := public.soml_chain_root_booking_id(NEW.linked_intro_booked_id);

  SELECT p.id, p.state INTO v_pending_id, v_current_state
  FROM public.soml_pending_referrals p
  WHERE public.soml_chain_root_booking_id(p.booking_id) = v_root_id
  ORDER BY p.created_at ASC
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
    UPDATE public.soml_pending_referrals
      SET state='not_converted',
          resolved_outcome = v_result,
          realized_at = NULL
      WHERE id = v_pending_id AND state = 'pending';
  END IF;

  RETURN NEW;
END;
$function$;

-- ── Backfill Brent Rogers ────────────────────────────────────────────────
-- Delete Koa's incorrect realized duplicate for the Jul 3 reschedule; realize
-- Zoe's Jun 23 root pending row against the same sale.
DELETE FROM public.soml_pending_referrals
WHERE booking_id = 'a5e62605-38e9-45c6-bc1b-cae00350ddc7';

UPDATE public.soml_pending_referrals
SET state = 'realized',
    resolved_outcome = 'PREMIER',
    realized_at = COALESCE(
      (SELECT buy_date FROM public.intros_run
        WHERE linked_intro_booked_id = 'a5e62605-38e9-45c6-bc1b-cae00350ddc7'
          AND upper(COALESCE(result_canon,'')) IN ('SALE','PREMIER','PREMIER_OTBEAT','ELITE','BASIC')
        ORDER BY created_at DESC LIMIT 1),
      (now() AT TIME ZONE 'America/Chicago')::date
    ),
    updated_at = now()
WHERE booking_id = '6dd18677-0d27-4498-9283-5ee9d88fe2a0'
  AND state <> 'realized';

-- ── Backfill any other chains with the same duplicate pattern ────────────
-- For every non-root pending row, if a pending/realized row exists for the
-- chain root, drop the child duplicate. Keep the chain-root pending row.
DELETE FROM public.soml_pending_referrals p
USING public.intros_booked b
WHERE p.booking_id = b.id
  AND b.originating_booking_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.soml_pending_referrals p2
    WHERE p2.booking_id = public.soml_chain_root_booking_id(p.booking_id)
      AND p2.id <> p.id
  );