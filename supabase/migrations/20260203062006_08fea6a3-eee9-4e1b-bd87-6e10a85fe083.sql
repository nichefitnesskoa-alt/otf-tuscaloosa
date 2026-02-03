-- Add date_closed column to sales_outside_intro table
ALTER TABLE public.sales_outside_intro 
ADD COLUMN IF NOT EXISTS date_closed date;