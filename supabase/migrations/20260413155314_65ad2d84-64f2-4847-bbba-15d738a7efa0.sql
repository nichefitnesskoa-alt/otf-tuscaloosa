-- Backfill nulls before making NOT NULL
UPDATE public.vip_sessions SET session_date = CURRENT_DATE WHERE session_date IS NULL;
UPDATE public.vip_sessions SET session_time = '09:00' WHERE session_time IS NULL;

-- Add new columns
ALTER TABLE public.vip_sessions
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'open',
  ADD COLUMN IF NOT EXISTS reserved_by_group text,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS is_on_availability_page boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS shareable_slug text UNIQUE,
  ADD COLUMN IF NOT EXISTS created_by text NOT NULL DEFAULT 'system',
  ADD COLUMN IF NOT EXISTS reserved_contact_name text,
  ADD COLUMN IF NOT EXISTS reserved_contact_email text,
  ADD COLUMN IF NOT EXISTS reserved_contact_phone text,
  ADD COLUMN IF NOT EXISTS estimated_group_size integer;

-- Make session_date and session_time NOT NULL
ALTER TABLE public.vip_sessions ALTER COLUMN session_date SET NOT NULL;
ALTER TABLE public.vip_sessions ALTER COLUMN session_time SET NOT NULL;

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.vip_sessions;