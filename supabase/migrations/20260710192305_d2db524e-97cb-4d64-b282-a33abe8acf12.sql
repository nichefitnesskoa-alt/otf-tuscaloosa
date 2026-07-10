
-- Helper: does this booking currently qualify as a referral for SOML pending?
CREATE OR REPLACE FUNCTION public.soml_booking_qualifies_as_referral(_booking_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  b public.intros_booked%ROWTYPE;
BEGIN
  SELECT * INTO b FROM public.intros_booked WHERE id = _booking_id;
  IF b.id IS NULL THEN RETURN false; END IF;
  IF b.deleted_at IS NOT NULL THEN RETURN false; END IF;

  -- Member/friend referral by lead_source
  IF (
    b.lead_source IN (
      'Member Referral',
      'Member Referral (5 class pack)',
      'Member Referral (3 class pack)',
      'Business Partnership Referral',
      'My Personal Friend I Invited'
    )
    OR (b.lead_source IS NOT NULL AND b.lead_source LIKE '%(Friend)')
  ) AND b.referred_by_member_name IS NOT NULL
    AND btrim(b.referred_by_member_name) <> '' THEN
    RETURN true;
  END IF;

  -- Friend paired-booking link
  IF b.paired_booking_id IS NOT NULL
     AND b.referred_by_member_name IS NOT NULL
     AND btrim(b.referred_by_member_name) <> '' THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

-- Sync function: on UPDATE of relevant cols, remove stale pending rows and
-- re-create when a booking newly qualifies.
CREATE OR REPLACE FUNCTION public.soml_sync_pending_referral_on_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_root_id uuid;
  v_qualifies boolean;
  v_existing_id uuid;
  v_existing_state text;
BEGIN
  v_root_id := public.soml_chain_root_booking_id(NEW.id);
  v_qualifies := public.soml_booking_qualifies_as_referral(v_root_id);

  SELECT p.id, p.state INTO v_existing_id, v_existing_state
  FROM public.soml_pending_referrals p
  WHERE public.soml_chain_root_booking_id(p.booking_id) = v_root_id
  ORDER BY p.created_at ASC
  LIMIT 1;

  -- No longer qualifies → drop the pending row (never touch realized/non-pending).
  IF NOT v_qualifies THEN
    IF v_existing_id IS NOT NULL AND v_existing_state = 'pending' THEN
      DELETE FROM public.soml_pending_referrals WHERE id = v_existing_id;
    END IF;
    RETURN NEW;
  END IF;

  -- Qualifies and none exists → delegate to the INSERT-creation function
  -- by calling it with NEW as the trigger row context. Simplest path: invoke
  -- the same body via a plain re-execution against the root booking.
  IF v_existing_id IS NULL THEN
    PERFORM public.soml_create_pending_referral_for_booking(v_root_id);
  END IF;

  RETURN NEW;
END;
$$;

-- Callable creator that mirrors the trigger function but takes a booking id.
-- Kept minimal: builds the same pending row the INSERT trigger would.
CREATE OR REPLACE FUNCTION public.soml_create_pending_referral_for_booking(_booking_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  b public.intros_booked%ROWTYPE;
  v_root_id uuid;
  v_root record;
  v_originator record;
  v_referring_name text;
  v_credit text;
  v_is_member_ref boolean;
  v_is_friend_link boolean;
  v_is_buddy boolean;
  v_buddy_contact text;
BEGIN
  SELECT * INTO b FROM public.intros_booked WHERE id = _booking_id;
  IF b.id IS NULL OR b.deleted_at IS NOT NULL THEN RETURN; END IF;

  v_is_member_ref := (
      b.lead_source IN (
        'Member Referral',
        'Member Referral (5 class pack)',
        'Member Referral (3 class pack)',
        'Business Partnership Referral',
        'My Personal Friend I Invited'
      )
      OR (b.lead_source IS NOT NULL AND b.lead_source LIKE '%(Friend)')
    )
    AND b.referred_by_member_name IS NOT NULL
    AND btrim(b.referred_by_member_name) <> '';

  v_is_friend_link := b.paired_booking_id IS NOT NULL
                      AND b.referred_by_member_name IS NOT NULL
                      AND btrim(b.referred_by_member_name) <> '';

  IF NOT v_is_member_ref AND NOT v_is_friend_link THEN RETURN; END IF;

  v_root_id := public.soml_chain_root_booking_id(b.id);
  IF EXISTS (
    SELECT 1 FROM public.soml_pending_referrals p
    WHERE public.soml_chain_root_booking_id(p.booking_id) = v_root_id
  ) THEN RETURN; END IF;

  SELECT id, booked_by, intro_owner, referred_by_member_name, paired_booking_id, is_buddy_card_referral
    INTO v_root
    FROM public.intros_booked WHERE id = v_root_id;

  IF v_is_member_ref THEN
    v_referring_name := btrim(COALESCE(v_root.referred_by_member_name, b.referred_by_member_name));
    v_credit := v_root.booked_by;
    IF v_credit IS NULL OR btrim(v_credit) = '' OR v_credit IN ('Self booked','Self-booked','System','system','Buddy Card') THEN
      v_credit := v_root.intro_owner;
    END IF;
    IF v_credit IS NULL OR btrim(v_credit) = '' THEN
      v_credit := b.booked_by;
      IF v_credit IS NULL OR btrim(v_credit) = '' OR v_credit IN ('Self booked','Self-booked','System','system','Buddy Card') THEN
        v_credit := b.intro_owner;
      END IF;
    END IF;
  ELSE
    SELECT id, member_name, booked_by, intro_owner, scheduler_link_sa
      INTO v_originator
      FROM public.intros_booked
      WHERE id = COALESCE(v_root.paired_booking_id, b.paired_booking_id);
    IF v_originator.id IS NULL THEN RETURN; END IF;
    v_referring_name := btrim(COALESCE(
      NULLIF(v_root.referred_by_member_name, ''),
      NULLIF(b.referred_by_member_name, ''),
      v_originator.member_name
    ));
    v_credit := COALESCE(
      NULLIF(v_originator.scheduler_link_sa, ''),
      NULLIF(v_originator.booked_by, ''),
      NULLIF(v_originator.intro_owner, '')
    );
    IF v_credit IN ('Self booked','Self-booked','System','system','Buddy Card') THEN
      v_credit := NULLIF(v_originator.intro_owner, '');
    END IF;
  END IF;

  IF v_credit IS NULL OR btrim(v_credit) = '' THEN RETURN; END IF;
  IF v_referring_name IS NULL OR btrim(v_referring_name) = '' THEN v_referring_name := 'Friend'; END IF;

  v_is_buddy := COALESCE(v_root.is_buddy_card_referral, b.is_buddy_card_referral, false);
  v_buddy_contact := NULL;
  IF v_is_buddy THEN
    SELECT l.referring_member_contact INTO v_buddy_contact
    FROM public.leads l
    WHERE l.booked_intro_id = v_root_id AND l.is_buddy_card = true
    ORDER BY l.created_at ASC LIMIT 1;
  END IF;

  INSERT INTO public.soml_pending_referrals (
    booking_id, referring_member, credited_sa, state,
    discount_owed_to, discount_owed_contact, discount_owed_amount_cents
  )
  VALUES (
    v_root_id, v_referring_name, v_credit, 'pending',
    CASE WHEN v_is_buddy THEN v_referring_name ELSE NULL END,
    CASE WHEN v_is_buddy THEN v_buddy_contact ELSE NULL END,
    CASE WHEN v_is_buddy THEN 5000 ELSE NULL END
  )
  ON CONFLICT (booking_id) DO NOTHING;
END;
$$;

-- Attach the UPDATE trigger on the columns that gate qualification.
DROP TRIGGER IF EXISTS soml_sync_pending_referral_on_update ON public.intros_booked;
CREATE TRIGGER soml_sync_pending_referral_on_update
AFTER UPDATE OF lead_source, referred_by_member_name, paired_booking_id, deleted_at
ON public.intros_booked
FOR EACH ROW
EXECUTE FUNCTION public.soml_sync_pending_referral_on_update();

-- One-time cleanup: remove pending rows whose current booking state no longer qualifies.
DELETE FROM public.soml_pending_referrals p
WHERE p.state = 'pending'
  AND NOT public.soml_booking_qualifies_as_referral(p.booking_id);
