ALTER TABLE public.milestones ADD COLUMN IF NOT EXISTS last_edited_by text;
ALTER TABLE public.milestones ADD COLUMN IF NOT EXISTS last_edited_at timestamptz;