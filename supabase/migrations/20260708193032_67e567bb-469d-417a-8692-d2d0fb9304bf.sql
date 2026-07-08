
-- Rename "Member Referral (5 class pack)" → "Member Referral (3 class pack)"
-- (only one existing row in each table)
UPDATE public.intros_booked
   SET lead_source = 'Member Referral (3 class pack)'
 WHERE lead_source = 'Member Referral (5 class pack)';

UPDATE public.leads
   SET source = 'Member Referral (3 class pack)'
 WHERE source = 'Member Referral (5 class pack)';

-- Update triggers to accept both old + new (backwards compatible).
CREATE OR REPLACE FUNCTION public.enforce_member_referral_has_referrer()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF (
       NEW.lead_source IN (
         'Member Referral',
         'Member Referral (5 class pack)',
         'Member Referral (3 class pack)',
         'Business Partnership Referral',
         'My Personal Friend I Invited'
       )
       OR (NEW.lead_source IS NOT NULL AND NEW.lead_source LIKE '%(Friend)')
     )
     AND (NEW.referred_by_member_name IS NULL OR btrim(NEW.referred_by_member_name) = '') THEN
    RAISE EXCEPTION 'Referral/friend lead sources require a referring member name (referred_by_member_name). Source: %', NEW.lead_source;
  END IF;
  RETURN NEW;
END;
$function$;

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
  v_buddy_contact   text;
  v_is_buddy        boolean;
BEGIN
  v_is_member_ref := (
      NEW.lead_source IN (
        'Member Referral',
        'Member Referral (5 class pack)',
        'Member Referral (3 class pack)',
        'Business Partnership Referral',
        'My Personal Friend I Invited'
      )
      OR (NEW.lead_source IS NOT NULL AND NEW.lead_source LIKE '%(Friend)')
    )
    AND NEW.referred_by_member_name IS NOT NULL
    AND btrim(NEW.referred_by_member_name) <> '';

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

  SELECT id, booked_by, intro_owner, referred_by_member_name, paired_booking_id, is_buddy_card_referral
    INTO v_root
    FROM public.intros_booked
    WHERE id = v_root_id;

  IF v_is_member_ref THEN
    v_referring_name := btrim(COALESCE(v_root.referred_by_member_name, NEW.referred_by_member_name));
    v_credit := v_root.booked_by;
    IF v_credit IS NULL OR btrim(v_credit) = '' OR v_credit IN ('Self booked','Self-booked','System','system','Buddy Card') THEN
      v_credit := v_root.intro_owner;
    END IF;
    IF v_credit IS NULL OR btrim(v_credit) = '' THEN
      v_credit := NEW.booked_by;
      IF v_credit IS NULL OR btrim(v_credit) = '' OR v_credit IN ('Self booked','Self-booked','System','system','Buddy Card') THEN
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
    IF v_credit IN ('Self booked','Self-booked','System','system','Buddy Card') THEN
      v_credit := NULLIF(v_originator.intro_owner, '');
    END IF;
  END IF;

  IF v_credit IS NULL OR btrim(v_credit) = '' THEN
    RETURN NEW;
  END IF;
  IF v_referring_name IS NULL OR btrim(v_referring_name) = '' THEN
    v_referring_name := 'Friend';
  END IF;

  v_is_buddy := COALESCE(v_root.is_buddy_card_referral, NEW.is_buddy_card_referral, false);
  v_buddy_contact := NULL;
  IF v_is_buddy THEN
    SELECT l.referring_member_contact
      INTO v_buddy_contact
      FROM public.leads l
      WHERE l.booked_intro_id = v_root_id
        AND l.is_buddy_card = true
      ORDER BY l.created_at ASC
      LIMIT 1;
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

  RETURN NEW;
END;
$function$;

-- Backfill: any existing self-sourced referral leads that don't yet have a
-- corresponding SOML manual referral entry get one, so referrals logged before
-- this fix show up on the SOML scoreboard for the sourcing SA.
INSERT INTO public.soml_manual_referrals (
  member_name, referring_member_name, referred_by, referred_at, notes, created_by
)
SELECT
  btrim(concat_ws(' ', l.first_name, l.last_name)),
  l.referred_by_member_name,
  l.sourced_by_sa,
  l.created_at,
  'Auto-created from self-sourced lead (backfill)',
  l.sourced_by_sa
FROM public.leads l
WHERE l.sourced_by_sa IS NOT NULL
  AND l.referred_by_member_name IS NOT NULL
  AND btrim(l.referred_by_member_name) <> ''
  AND l.source IN (
    'Member Referral',
    'Member Referral (5 class pack)',
    'Member Referral (3 class pack)',
    'Business Partnership Referral',
    'My Personal Friend I Invited'
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.soml_manual_referrals m
    WHERE lower(btrim(m.member_name)) = lower(btrim(concat_ws(' ', l.first_name, l.last_name)))
      AND m.referred_by = l.sourced_by_sa
  );
