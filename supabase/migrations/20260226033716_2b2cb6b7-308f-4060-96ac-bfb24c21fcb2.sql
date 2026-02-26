-- Phase 1 schema change (B4)
ALTER TABLE public.intros_run
ADD COLUMN IF NOT EXISTS second_intro_reason text;