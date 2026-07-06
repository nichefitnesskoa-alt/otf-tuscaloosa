DROP TRIGGER IF EXISTS trg_soml_pending_referral_on_booking ON public.intros_booked;
CREATE TRIGGER trg_soml_pending_referral_on_booking
AFTER INSERT OR UPDATE OF lead_source, referred_by_member_name, paired_booking_id, is_buddy_card_referral
ON public.intros_booked
FOR EACH ROW EXECUTE FUNCTION public.soml_create_pending_referral();