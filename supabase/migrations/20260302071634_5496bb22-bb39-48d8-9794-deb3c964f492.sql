ALTER TABLE public.intros_booked 
ADD COLUMN IF NOT EXISTS coach_brief_human_detail text,
ADD COLUMN IF NOT EXISTS coach_brief_why_moment text;