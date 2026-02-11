
-- Add paired_booking_id for friend booking linkage
ALTER TABLE public.intros_booked 
ADD COLUMN paired_booking_id uuid REFERENCES public.intros_booked(id);
