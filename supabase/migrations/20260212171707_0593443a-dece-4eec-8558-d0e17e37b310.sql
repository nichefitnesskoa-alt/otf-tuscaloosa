
-- Add referred_by_member_name to intros_booked
ALTER TABLE public.intros_booked ADD COLUMN IF NOT EXISTS referred_by_member_name TEXT;
