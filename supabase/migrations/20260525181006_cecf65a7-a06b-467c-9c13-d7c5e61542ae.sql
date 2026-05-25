ALTER TABLE public.vip_sessions
  ADD COLUMN IF NOT EXISTS contact_outcome text,
  ADD COLUMN IF NOT EXISTS contact_outcome_logged_at timestamptz,
  ADD COLUMN IF NOT EXISTS contact_outcome_logged_by text;

ALTER TABLE public.giveaway_studios
  ADD COLUMN IF NOT EXISTS action_verification_modes jsonb NOT NULL DEFAULT '{}'::jsonb;