ALTER TABLE public.intros_booked
  ADD COLUMN coach_debrief_submitted boolean NOT NULL DEFAULT false,
  ADD COLUMN coach_debrief_submitted_at timestamptz,
  ADD COLUMN coach_debrief_submitted_by text;