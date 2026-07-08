CREATE OR REPLACE FUNCTION public.soml_resolve_after_late_pending_create()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE public.intros_run r
  SET result_canon = r.result_canon,
      last_edited_at = now(),
      last_edited_by = COALESCE(NULLIF(r.last_edited_by, ''), 'System (SOML late referral sync)'),
      edit_reason = 'Re-evaluate SOML pending referral after late referral source attribution'
  WHERE r.linked_intro_booked_id IS NOT NULL
    AND public.soml_chain_root_booking_id(r.linked_intro_booked_id) =
        public.soml_chain_root_booking_id(NEW.booking_id)
    AND r.result_canon IS NOT NULL;
  RETURN NEW;
END;
$function$;