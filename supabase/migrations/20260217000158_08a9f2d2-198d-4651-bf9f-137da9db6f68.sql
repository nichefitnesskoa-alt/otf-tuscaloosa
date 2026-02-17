ALTER TABLE public.intro_questionnaires 
  ADD COLUMN IF NOT EXISTS last_opened_at timestamptz;