-- Add prep tracking fields to intros_booked
ALTER TABLE public.intros_booked
  ADD COLUMN IF NOT EXISTS prepped boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS prepped_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS prepped_by text;

-- Add prep rate target thresholds are computed on frontend, no DB change needed
