-- Add buy_date column to intros_run table for tracking when the sale actually closed
ALTER TABLE public.intros_run 
ADD COLUMN IF NOT EXISTS buy_date date;

-- Add linked_intro_booked_id to link intros_run to intros_booked records
ALTER TABLE public.intros_run 
ADD COLUMN IF NOT EXISTS linked_intro_booked_id uuid REFERENCES public.intros_booked(id);

-- Add sa_name to intros_run so we can query by staff for commission reports
ALTER TABLE public.intros_run 
ADD COLUMN IF NOT EXISTS sa_name text;

-- Create index for pay period queries
CREATE INDEX IF NOT EXISTS idx_intros_run_buy_date ON public.intros_run(buy_date);
CREATE INDEX IF NOT EXISTS idx_intros_run_sa_name ON public.intros_run(sa_name);