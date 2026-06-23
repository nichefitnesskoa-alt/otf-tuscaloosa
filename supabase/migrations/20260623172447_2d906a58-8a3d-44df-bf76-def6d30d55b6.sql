ALTER TABLE public.vip_registrations
  ADD COLUMN IF NOT EXISTS mindbody_imported_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS mindbody_imported_by text NULL;