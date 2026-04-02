
ALTER TABLE public.intros_booked
  ADD COLUMN IF NOT EXISTS coach_shoutout_start boolean,
  ADD COLUMN IF NOT EXISTS coach_shoutout_end boolean,
  ADD COLUMN IF NOT EXISTS coach_referral_asked boolean,
  ADD COLUMN IF NOT EXISTS coach_referral_names text;
