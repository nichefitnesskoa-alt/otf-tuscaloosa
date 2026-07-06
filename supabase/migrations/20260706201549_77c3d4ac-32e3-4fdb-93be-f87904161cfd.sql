
-- 1. Tighten trigger: for friend-link flow, require this booking to be the
--    "friend" side (has referred_by_member_name), not the originator.
CREATE OR REPLACE FUNCTION public.soml_create_pending_referral()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_credit          text;
  v_root_id         uuid;
  v_root            record;
  v_existing        uuid;
  v_is_member_ref   boolean;
  v_is_friend_link  boolean;
  v_originator      record;
  v_referring_name  text;
BEGIN
  v_is_member_ref := NEW.lead_source IN ('Member Referral','Member Referral (5 class pack)')
                     AND NEW.referred_by_member_name IS NOT NULL
                     AND btrim(NEW.referred_by_member_name) <> '';

  -- Only the incoming friend booking has BOTH paired_booking_id and
  -- referred_by_member_name populated; the originator gets paired_booking_id
  -- back-linked but never a referred_by_member_name.
  v_is_friend_link := NEW.paired_booking_id IS NOT NULL
                      AND NEW.referred_by_member_name IS NOT NULL
                      AND btrim(NEW.referred_by_member_name) <> '';

  IF NOT v_is_member_ref AND NOT v_is_friend_link THEN
    RETURN NEW;
  END IF;

  v_root_id := public.soml_chain_root_booking_id(NEW.id);

  SELECT p.id INTO v_existing
  FROM public.soml_pending_referrals p
  WHERE public.soml_chain_root_booking_id(p.booking_id) = v_root_id
  LIMIT 1;
  IF v_existing IS NOT NULL THEN
    RETURN NEW;
  END IF;

  SELECT id, booked_by, intro_owner, referred_by_member_name, paired_booking_id
    INTO v_root
    FROM public.intros_booked
    WHERE id = v_root_id;

  IF v_is_member_ref THEN
    v_referring_name := btrim(COALESCE(v_root.referred_by_member_name, NEW.referred_by_member_name));
    v_credit := v_root.booked_by;
    IF v_credit IS NULL OR btrim(v_credit) = '' OR v_credit IN ('Self booked','Self-booked','System','system') THEN
      v_credit := v_root.intro_owner;
    END IF;
    IF v_credit IS NULL OR btrim(v_credit) = '' THEN
      v_credit := NEW.booked_by;
      IF v_credit IS NULL OR btrim(v_credit) = '' OR v_credit IN ('Self booked','Self-booked','System','system') THEN
        v_credit := NEW.intro_owner;
      END IF;
    END IF;
  ELSE
    SELECT id, member_name, booked_by, intro_owner, scheduler_link_sa
      INTO v_originator
      FROM public.intros_booked
      WHERE id = COALESCE(v_root.paired_booking_id, NEW.paired_booking_id);
    IF v_originator.id IS NULL THEN
      RETURN NEW;
    END IF;
    v_referring_name := btrim(COALESCE(
      NULLIF(v_root.referred_by_member_name, ''),
      NULLIF(NEW.referred_by_member_name, ''),
      v_originator.member_name
    ));
    v_credit := COALESCE(
      NULLIF(v_originator.scheduler_link_sa, ''),
      NULLIF(v_originator.booked_by, ''),
      NULLIF(v_originator.intro_owner, '')
    );
    IF v_credit IN ('Self booked','Self-booked','System','system') THEN
      v_credit := NULLIF(v_originator.intro_owner, '');
    END IF;
  END IF;

  IF v_credit IS NULL OR btrim(v_credit) = '' THEN
    RETURN NEW;
  END IF;
  IF v_referring_name IS NULL OR btrim(v_referring_name) = '' THEN
    v_referring_name := 'Friend';
  END IF;

  INSERT INTO public.soml_pending_referrals (booking_id, referring_member, credited_sa, state)
  VALUES (v_root_id, v_referring_name, v_credit, 'pending')
  ON CONFLICT (booking_id) DO NOTHING;

  RETURN NEW;
END;
$function$;

-- 2. Clean up: delete pending rows for bookings that are originator-side
--    (paired_booking_id set but no referred_by_member_name), and are NOT
--    Member Referral sources. Only touch pending state (never realized).
DELETE FROM public.soml_pending_referrals p
USING public.intros_booked b
WHERE p.booking_id = b.id
  AND p.state = 'pending'
  AND b.paired_booking_id IS NOT NULL
  AND (b.referred_by_member_name IS NULL OR btrim(b.referred_by_member_name) = '')
  AND b.lead_source NOT IN ('Member Referral','Member Referral (5 class pack)');
