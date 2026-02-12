
-- Add phone and email columns to intros_booked
ALTER TABLE public.intros_booked ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE public.intros_booked ADD COLUMN IF NOT EXISTS email text;
