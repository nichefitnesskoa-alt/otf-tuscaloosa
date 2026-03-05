
-- Add application_slug column for human-readable URLs
ALTER TABLE public.candidates ADD COLUMN IF NOT EXISTS application_slug text UNIQUE;

-- Change role from text to text[] — wrap existing values in array
ALTER TABLE public.candidates ALTER COLUMN role TYPE text[] USING ARRAY[role];

-- Set default for role column
ALTER TABLE public.candidates ALTER COLUMN role SET DEFAULT '{}';
