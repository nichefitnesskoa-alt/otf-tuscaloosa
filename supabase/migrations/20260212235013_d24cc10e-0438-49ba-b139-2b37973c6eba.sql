-- Add VIP flag to intros_booked
ALTER TABLE public.intros_booked ADD COLUMN is_vip boolean NOT NULL DEFAULT false;

-- Backfill: mark existing VIP bookings
UPDATE public.intros_booked SET is_vip = true WHERE lead_source = 'VIP Class';

-- Create index for VIP filtering
CREATE INDEX idx_intros_booked_is_vip ON public.intros_booked (is_vip);
