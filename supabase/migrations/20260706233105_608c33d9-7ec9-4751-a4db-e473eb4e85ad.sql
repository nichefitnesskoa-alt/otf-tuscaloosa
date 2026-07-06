
-- 1) Propagate lead_source edits from intros_run → linked intros_booked so the
--    booking trigger (soml_create_pending_referral, already UPDATE-aware) fires
--    with the correct source of truth. intros_run does not store a referring
--    member name; the run save handler in the app writes that directly to the
--    booking. This trigger only pushes lead_source down.
CREATE OR REPLACE FUNCTION public.propagate_run_referral_to_booking()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_booking public.intros_booked%ROWTYPE;
BEGIN
  IF NEW.linked_intro_booked_id IS NULL THEN RETURN NEW; END IF;
  IF NEW.lead_source IS NOT DISTINCT FROM OLD.lead_source THEN RETURN NEW; END IF;
  IF NEW.lead_source IS NULL OR btrim(NEW.lead_source) = '' THEN RETURN NEW; END IF;

  SELECT * INTO v_booking
    FROM public.intros_booked
    WHERE id = NEW.linked_intro_booked_id;
  IF v_booking.id IS NULL THEN RETURN NEW; END IF;
  IF v_booking.lead_source IS NOT DISTINCT FROM NEW.lead_source THEN RETURN NEW; END IF;

  UPDATE public.intros_booked
  SET lead_source = NEW.lead_source,
      last_edited_at = now(),
      last_edited_by = COALESCE(v_booking.last_edited_by, 'System (run referral sync)'),
      edit_reason = 'Auto-sync: lead source edited on linked run'
  WHERE id = v_booking.id;

  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_propagate_run_referral_to_booking ON public.intros_run;
CREATE TRIGGER trg_propagate_run_referral_to_booking
AFTER UPDATE OF lead_source
ON public.intros_run
FOR EACH ROW
EXECUTE FUNCTION public.propagate_run_referral_to_booking();


-- 2) After a pending referral is created (from a late edit), immediately
--    resolve it if the linked run already has a terminal result. Re-touching
--    the run fires soml_resolve_pending_referral.
CREATE OR REPLACE FUNCTION public.soml_resolve_after_late_pending_create()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  UPDATE public.intros_run r
  SET updated_at = now()
  WHERE r.linked_intro_booked_id IS NOT NULL
    AND public.soml_chain_root_booking_id(r.linked_intro_booked_id) =
        public.soml_chain_root_booking_id(NEW.booking_id)
    AND r.result_canon IS NOT NULL;
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_soml_resolve_after_late_pending_create ON public.soml_pending_referrals;
CREATE TRIGGER trg_soml_resolve_after_late_pending_create
AFTER INSERT ON public.soml_pending_referrals
FOR EACH ROW
EXECUTE FUNCTION public.soml_resolve_after_late_pending_create();


-- 3) Backfill: bookings whose current source is referral-like with a referring
--    member name but no pending referral row exists → touch them to fire the
--    UPDATE-aware booking trigger. Idempotent thanks to v_existing guard.
UPDATE public.intros_booked b
SET last_edited_at = now(),
    edit_reason = COALESCE(b.edit_reason, '') || ' [auto-backfill: retro referral attribution]'
WHERE (
    b.lead_source IN (
      'Member Referral',
      'Member Referral (5 class pack)',
      'Business Partnership Referral',
      'My Personal Friend I Invited'
    )
    OR (b.lead_source IS NOT NULL AND b.lead_source LIKE '%(Friend)')
  )
  AND b.referred_by_member_name IS NOT NULL
  AND btrim(b.referred_by_member_name) <> ''
  AND b.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.soml_pending_referrals p
    WHERE public.soml_chain_root_booking_id(p.booking_id) =
          public.soml_chain_root_booking_id(b.id)
  );
