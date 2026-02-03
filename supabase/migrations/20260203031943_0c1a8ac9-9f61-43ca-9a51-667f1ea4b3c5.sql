-- Add stable IDs and audit columns to shift_recaps
ALTER TABLE public.shift_recaps 
ADD COLUMN IF NOT EXISTS shift_id text UNIQUE,
ADD COLUMN IF NOT EXISTS last_edited_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS last_edited_by text,
ADD COLUMN IF NOT EXISTS edit_reason text,
ADD COLUMN IF NOT EXISTS sheets_row_number integer;

-- Add stable IDs and audit columns to intros_booked
ALTER TABLE public.intros_booked 
ADD COLUMN IF NOT EXISTS booking_id text UNIQUE,
ADD COLUMN IF NOT EXISTS intro_time time without time zone,
ADD COLUMN IF NOT EXISTS last_edited_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS last_edited_by text,
ADD COLUMN IF NOT EXISTS edit_reason text,
ADD COLUMN IF NOT EXISTS sheets_row_number integer;

-- Add intro_owner and audit columns to intros_run
ALTER TABLE public.intros_run 
ADD COLUMN IF NOT EXISTS run_id text UNIQUE,
ADD COLUMN IF NOT EXISTS intro_owner text,
ADD COLUMN IF NOT EXISTS intro_owner_locked boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS run_date date,
ADD COLUMN IF NOT EXISTS lead_source text,
ADD COLUMN IF NOT EXISTS goal_quality text,
ADD COLUMN IF NOT EXISTS pricing_engagement text,
ADD COLUMN IF NOT EXISTS fvc_completed boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS rfg_presented boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS choice_architecture boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS halfway_encouragement boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS premobility_encouragement boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS coaching_summary_presence boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS last_edited_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS last_edited_by text,
ADD COLUMN IF NOT EXISTS edit_reason text,
ADD COLUMN IF NOT EXISTS sheets_row_number integer;

-- Add pay period and audit columns to sales_outside_intro and rename to app_sales concept
ALTER TABLE public.sales_outside_intro 
ADD COLUMN IF NOT EXISTS sale_id text UNIQUE,
ADD COLUMN IF NOT EXISTS sale_type text DEFAULT 'outside_intro',
ADD COLUMN IF NOT EXISTS intro_owner text,
ADD COLUMN IF NOT EXISTS pay_period_start date,
ADD COLUMN IF NOT EXISTS pay_period_end date,
ADD COLUMN IF NOT EXISTS last_edited_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS last_edited_by text,
ADD COLUMN IF NOT EXISTS edit_reason text,
ADD COLUMN IF NOT EXISTS sheets_row_number integer;

-- Allow updates and deletes on intros_booked for the new workflow
CREATE POLICY "Allow public update access" ON public.intros_booked 
FOR UPDATE USING (true);

CREATE POLICY "Allow public delete access" ON public.intros_booked 
FOR DELETE USING (true);

-- Allow updates and deletes on intros_run
CREATE POLICY "Allow public update access" ON public.intros_run 
FOR UPDATE USING (true);

CREATE POLICY "Allow public delete access" ON public.intros_run 
FOR DELETE USING (true);

-- Allow updates and deletes on sales_outside_intro
CREATE POLICY "Allow public update access" ON public.sales_outside_intro 
FOR UPDATE USING (true);

CREATE POLICY "Allow public delete access" ON public.sales_outside_intro 
FOR DELETE USING (true);

-- Generate stable IDs for existing records
UPDATE public.shift_recaps 
SET shift_id = CONCAT('shift_', id::text) 
WHERE shift_id IS NULL;

UPDATE public.intros_booked 
SET booking_id = CONCAT('booking_', id::text) 
WHERE booking_id IS NULL;

UPDATE public.intros_run 
SET run_id = CONCAT('run_', id::text),
    run_date = COALESCE(buy_date, CURRENT_DATE)
WHERE run_id IS NULL;

UPDATE public.sales_outside_intro 
SET sale_id = CONCAT('sale_', id::text) 
WHERE sale_id IS NULL;