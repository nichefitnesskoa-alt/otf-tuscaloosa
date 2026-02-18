-- Update the booking_type_canon validation trigger to allow COMP
CREATE OR REPLACE FUNCTION public.validate_booking_type_canon()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW.booking_type_canon NOT IN ('STANDARD', 'VIP', 'COMP') THEN
    RAISE EXCEPTION 'Invalid booking_type_canon: %', NEW.booking_type_canon;
  END IF;
  RETURN NEW;
END;
$function$;