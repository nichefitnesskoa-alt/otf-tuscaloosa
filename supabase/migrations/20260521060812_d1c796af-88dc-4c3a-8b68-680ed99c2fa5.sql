ALTER TABLE public.giveaway_studios
  ADD COLUMN IF NOT EXISTS title_format text NOT NULL DEFAULT 'auto_combined',
  ADD COLUMN IF NOT EXISTS custom_title text;

ALTER TABLE public.giveaway_studios
  DROP CONSTRAINT IF EXISTS giveaway_studios_title_format_check;

ALTER TABLE public.giveaway_studios
  ADD CONSTRAINT giveaway_studios_title_format_check
  CHECK (title_format IN ('auto_combined', 'auto_studio_only', 'custom'));