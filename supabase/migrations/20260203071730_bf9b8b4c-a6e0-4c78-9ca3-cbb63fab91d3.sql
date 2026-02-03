-- Add ignore_from_metrics field to intros_run table
ALTER TABLE public.intros_run
ADD COLUMN IF NOT EXISTS ignore_from_metrics boolean DEFAULT false;

-- Add ignore_from_metrics field to intros_booked table
ALTER TABLE public.intros_booked
ADD COLUMN IF NOT EXISTS ignore_from_metrics boolean DEFAULT false;