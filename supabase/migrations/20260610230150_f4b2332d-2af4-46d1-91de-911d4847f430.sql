ALTER TABLE public.table_owner_entries
  ADD COLUMN IF NOT EXISTS commitment text,
  ADD COLUMN IF NOT EXISTS serves_wig text,
  ADD COLUMN IF NOT EXISTS prior_status text,
  ADD COLUMN IF NOT EXISTS prior_result text;

ALTER TABLE public.table_owner_entries
  DROP CONSTRAINT IF EXISTS table_owner_entries_prior_status_check;
ALTER TABLE public.table_owner_entries
  ADD CONSTRAINT table_owner_entries_prior_status_check
  CHECK (prior_status IS NULL OR prior_status IN ('kept','broken'));