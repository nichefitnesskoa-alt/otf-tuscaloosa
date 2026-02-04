-- Add the missing booked_by column to intros_booked
-- This stores who booked the intro (booking credit), separate from intro_owner (commission credit)
ALTER TABLE public.intros_booked 
ADD COLUMN IF NOT EXISTS booked_by text;

-- Backfill booked_by from sa_working_shift for existing records
-- sa_working_shift has been serving this purpose, so we copy its value
UPDATE public.intros_booked 
SET booked_by = sa_working_shift 
WHERE booked_by IS NULL AND sa_working_shift IS NOT NULL;

-- Add originating_booking_id for tracking 2nd intros
ALTER TABLE public.intros_booked 
ADD COLUMN IF NOT EXISTS originating_booking_id uuid REFERENCES public.intros_booked(id);

-- Add comment for clarity
COMMENT ON COLUMN public.intros_booked.booked_by IS 'SA who scheduled/booked the intro (booking credit)';
COMMENT ON COLUMN public.intros_booked.intro_owner IS 'SA who ran the first intro (commission + quality credit), set on first run';
COMMENT ON COLUMN public.intros_booked.originating_booking_id IS 'Links 2nd intros back to original booking for chain tracking';