
ALTER FUNCTION public.auto_set_self_booked() SET search_path = public;
ALTER FUNCTION public.auto_set_booked_by_self_booked() SET search_path = public;
ALTER FUNCTION public.validate_booking_type_canon() SET search_path = public;
ALTER FUNCTION public.enforce_intro_time_canon() SET search_path = public;
ALTER FUNCTION public.validate_questionnaire_status_canon() SET search_path = public;
ALTER FUNCTION public.update_updated_at_column() SET search_path = public;
ALTER FUNCTION public.to_intro_time_canonical(text) SET search_path = public;

ALTER VIEW public.sa_wig_summary SET (security_invoker = on);
ALTER VIEW public.milestone_summary SET (security_invoker = on);
