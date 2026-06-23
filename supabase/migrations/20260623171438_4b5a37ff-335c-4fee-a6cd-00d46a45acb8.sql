ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS mindbody_imported_at timestamptz,
  ADD COLUMN IF NOT EXISTS mindbody_imported_by text;

CREATE INDEX IF NOT EXISTS leads_mindbody_imported_at_idx
  ON public.leads (mindbody_imported_at)
  WHERE mindbody_imported_at IS NOT NULL;