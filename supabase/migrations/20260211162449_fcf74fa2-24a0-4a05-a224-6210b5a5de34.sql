
-- Create referrals table for tracking friend referral discounts
CREATE TABLE public.referrals (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  referrer_booking_id uuid,
  referred_booking_id uuid,
  referrer_name text NOT NULL,
  referred_name text NOT NULL,
  discount_applied boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

-- Open RLS policies (matching existing table patterns)
CREATE POLICY "Allow all read referrals" ON public.referrals FOR SELECT USING (true);
CREATE POLICY "Allow all insert referrals" ON public.referrals FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all update referrals" ON public.referrals FOR UPDATE USING (true);
CREATE POLICY "Allow all delete referrals" ON public.referrals FOR DELETE USING (true);
