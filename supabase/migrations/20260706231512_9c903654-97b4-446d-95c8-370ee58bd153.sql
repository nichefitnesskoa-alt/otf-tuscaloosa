CREATE OR REPLACE FUNCTION public.enforce_member_referral_has_referrer()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Mirror of src/lib/sa/leadsBooked.ts isReferralLikeSource(): every referral
  -- or "(Friend)" variant must carry a referring member name so SOML tracking
  -- and staff credit stay coherent.
  IF (
       NEW.lead_source IN (
         'Member Referral',
         'Member Referral (5 class pack)',
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