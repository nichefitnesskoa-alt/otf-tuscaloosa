ALTER TABLE public.vip_registrations
ADD COLUMN IF NOT EXISTS outcome text,
ADD COLUMN IF NOT EXISTS outcome_notes text,
ADD COLUMN IF NOT EXISTS outcome_logged_at timestamptz,
ADD COLUMN IF NOT EXISTS outcome_logged_by text;