
-- Add VIP lifecycle fields to intros_booked
ALTER TABLE public.intros_booked
  ADD COLUMN IF NOT EXISTS vip_status text NULL,
  ADD COLUMN IF NOT EXISTS converted_to_booking_id uuid NULL;

-- Add VIP fields to intros_run
ALTER TABLE public.intros_run
  ADD COLUMN IF NOT EXISTS is_vip boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS vip_session_id uuid NULL,
  ADD COLUMN IF NOT EXISTS vip_converted boolean NOT NULL DEFAULT false;

-- Backfill vip_status for existing VIP bookings
UPDATE public.intros_booked
SET vip_status = 'REGISTERED'
WHERE is_vip = true AND vip_status IS NULL;

-- Backfill is_vip on intros_run from linked VIP bookings
UPDATE public.intros_run r
SET is_vip = true
FROM public.intros_booked b
WHERE r.linked_intro_booked_id = b.id
  AND b.is_vip = true
  AND r.is_vip = false;

-- Backfill vip_session_id on intros_run from linked bookings
UPDATE public.intros_run r
SET vip_session_id = b.vip_session_id
FROM public.intros_booked b
WHERE r.linked_intro_booked_id = b.id
  AND b.vip_session_id IS NOT NULL
  AND r.vip_session_id IS NULL;
