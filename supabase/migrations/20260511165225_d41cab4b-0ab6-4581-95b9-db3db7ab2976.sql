ALTER TABLE public.vip_registrations
  ADD COLUMN IF NOT EXISTS membership_type text NULL,
  ADD COLUMN IF NOT EXISTS commission_amount numeric NULL,
  ADD COLUMN IF NOT EXISTS purchased_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS converted_to_booking_id uuid NULL,
  ADD COLUMN IF NOT EXISTS converted_to_run_id uuid NULL;