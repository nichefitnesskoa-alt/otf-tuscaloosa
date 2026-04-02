ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

-- Ensure all existing staff are active
UPDATE public.staff SET is_active = true WHERE is_active IS NULL;