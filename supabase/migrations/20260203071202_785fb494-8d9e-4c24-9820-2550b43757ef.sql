-- Add booking status and related fields to intros_booked table
ALTER TABLE public.intros_booked 
ADD COLUMN IF NOT EXISTS booking_status text DEFAULT 'Active',
ADD COLUMN IF NOT EXISTS closed_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS closed_by text,
ADD COLUMN IF NOT EXISTS intro_owner text,
ADD COLUMN IF NOT EXISTS intro_owner_locked boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS deleted_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS deleted_by text,
ADD COLUMN IF NOT EXISTS delete_reason text,
ADD COLUMN IF NOT EXISTS ignore_from_metrics boolean DEFAULT false;

-- Add ran_by field to intros_run to track who ran the intro
ALTER TABLE public.intros_run
ADD COLUMN IF NOT EXISTS ran_by text;

-- Update existing Active bookings (those without a status)
UPDATE public.intros_booked 
SET booking_status = 'Active' 
WHERE booking_status IS NULL;

-- Create an index on booking_status for faster filtering
CREATE INDEX IF NOT EXISTS idx_intros_booked_status ON public.intros_booked(booking_status);

-- Create a partial index for active bookings (most common query)
CREATE INDEX IF NOT EXISTS idx_intros_booked_active ON public.intros_booked(class_date) WHERE booking_status = 'Active';