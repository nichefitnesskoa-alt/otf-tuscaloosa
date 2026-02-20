
-- Add duplicate detection fields to leads table
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS duplicate_notes text,
  ADD COLUMN IF NOT EXISTS duplicate_confidence text,
  ADD COLUMN IF NOT EXISTS duplicate_match_type text,
  ADD COLUMN IF NOT EXISTS duplicate_override boolean DEFAULT false;

-- Update the stage check constraint to include new stages if there is one (we add via comment only, stages are open text)
-- No constraint needed, stage is free-text
COMMENT ON COLUMN public.leads.duplicate_notes IS 'Details of duplicate match: table, id, name, existing status';
COMMENT ON COLUMN public.leads.duplicate_confidence IS 'HIGH, MEDIUM, LOW, or NONE — from deduplication engine';
COMMENT ON COLUMN public.leads.duplicate_match_type IS 'phone, email, name_date, name_only, or null';
COMMENT ON COLUMN public.leads.duplicate_override IS 'True when SA manually confirmed this is NOT a duplicate';
