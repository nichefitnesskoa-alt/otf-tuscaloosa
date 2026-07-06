
-- 1. New goal columns
ALTER TABLE public.soml_config
  ADD COLUMN IF NOT EXISTS referral_leads_goal integer NOT NULL DEFAULT 0;

ALTER TABLE public.soml_sa_goals
  ADD COLUMN IF NOT EXISTS referral_leads_goal integer;

-- 2. Expanded pending-referral trigger
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

  v_is_friend_link := NEW.paired_booking_id IS NOT NULL;

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

-- 3. Backfill via direct INSERT (compute credit + referrer inline).
INSERT INTO public.soml_pending_referrals (booking_id, referring_member, credited_sa, state)
SELECT
  public.soml_chain_root_booking_id(b.id) AS booking_id,
  COALESCE(
    NULLIF(btrim(b.referred_by_member_name), ''),
    NULLIF(btrim(o.member_name), ''),
    'Friend'
  ) AS referring_member,
  COALESCE(
    NULLIF(o.scheduler_link_sa, ''),
    NULLIF(o.booked_by, ''),
    NULLIF(o.intro_owner, '')
  ) AS credited_sa,
  'pending'
FROM public.intros_booked b
JOIN public.intros_booked o ON o.id = b.paired_booking_id
WHERE b.paired_booking_id IS NOT NULL
  AND b.deleted_at IS NULL
  AND COALESCE(
    NULLIF(o.scheduler_link_sa, ''),
    NULLIF(o.booked_by, ''),
    NULLIF(o.intro_owner, '')
  ) NOT IN ('Self booked','Self-booked','System','system')
  AND COALESCE(
    NULLIF(o.scheduler_link_sa, ''),
    NULLIF(o.booked_by, ''),
    NULLIF(o.intro_owner, '')
  ) IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.soml_pending_referrals p
    WHERE public.soml_chain_root_booking_id(p.booking_id)
          = public.soml_chain_root_booking_id(b.id)
  )
ON CONFLICT (booking_id) DO NOTHING;
