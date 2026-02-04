-- Add new lead measures columns to intros_run
ALTER TABLE public.intros_run 
ADD COLUMN IF NOT EXISTS goal_why_captured text,
ADD COLUMN IF NOT EXISTS relationship_experience text,
ADD COLUMN IF NOT EXISTS made_a_friend boolean DEFAULT false;

-- Create daily_recaps table for GroupMe posting
CREATE TABLE public.daily_recaps (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  shift_date date NOT NULL,
  staff_name text NOT NULL,
  recap_text text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  error_message text,
  shift_recap_id uuid REFERENCES public.shift_recaps(id)
);

-- Enable Row Level Security
ALTER TABLE public.daily_recaps ENABLE ROW LEVEL SECURITY;

-- RLS policies for daily_recaps (public access for now since no user auth)
CREATE POLICY "Allow public read access" 
ON public.daily_recaps 
FOR SELECT 
USING (true);

CREATE POLICY "Allow public insert access" 
ON public.daily_recaps 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Allow public update access" 
ON public.daily_recaps 
FOR UPDATE 
USING (true);

CREATE POLICY "Allow public delete access" 
ON public.daily_recaps 
FOR DELETE 
USING (true);

-- Add date_closed column to sales_outside_intro if not present
ALTER TABLE public.sales_outside_intro 
ADD COLUMN IF NOT EXISTS date_closed date;