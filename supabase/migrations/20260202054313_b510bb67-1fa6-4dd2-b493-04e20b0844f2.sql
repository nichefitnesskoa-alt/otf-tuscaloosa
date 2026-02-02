-- Create staff table
CREATE TABLE public.staff (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL CHECK (role IN ('SA', 'Coach', 'Admin')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Insert initial staff data
INSERT INTO public.staff (name, role) VALUES
  ('Bre', 'Coach'),
  ('Elizabeth', 'Coach'),
  ('James', 'Coach'),
  ('Nathan', 'Coach'),
  ('Kaitlyn H', 'Coach'),
  ('Natalya', 'Coach'),
  ('Bri', 'SA'),
  ('Grace', 'SA'),
  ('Katie', 'SA'),
  ('Kailey', 'SA'),
  ('Kayla', 'SA'),
  ('Koa', 'Admin'),
  ('Lauren', 'SA'),
  ('Nora', 'SA'),
  ('Sophie', 'SA');

-- Create IG leads table
CREATE TABLE public.ig_leads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sa_name TEXT NOT NULL,
  date_added DATE NOT NULL DEFAULT CURRENT_DATE,
  instagram_handle TEXT NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT,
  phone_number TEXT,
  email TEXT,
  interest_level TEXT NOT NULL,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'not_booked' CHECK (status IN ('not_booked', 'booked', 'no_show', 'closed')),
  synced_to_sheets BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create shift recaps table
CREATE TABLE public.shift_recaps (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  staff_name TEXT NOT NULL,
  shift_date DATE NOT NULL,
  shift_type TEXT NOT NULL CHECK (shift_type IN ('AM Shift', 'PM Shift', 'Mid Shift')),
  
  -- Activity tracking
  calls_made INTEGER DEFAULT 0,
  texts_sent INTEGER DEFAULT 0,
  emails_sent INTEGER DEFAULT 0,
  dms_sent INTEGER DEFAULT 0,
  
  -- Admin fields (Coaches)
  otbeat_sales INTEGER,
  otbeat_buyer_names TEXT,
  upgrades INTEGER,
  upgrade_details TEXT,
  downgrades INTEGER,
  downgrade_details TEXT,
  cancellations INTEGER,
  cancellation_details TEXT,
  freezes INTEGER,
  freeze_details TEXT,
  
  -- Misc
  milestones_celebrated TEXT,
  equipment_issues TEXT,
  other_info TEXT,
  
  synced_to_sheets BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  submitted_at TIMESTAMP WITH TIME ZONE
);

-- Create intros booked table
CREATE TABLE public.intros_booked (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  shift_recap_id UUID REFERENCES public.shift_recaps(id) ON DELETE CASCADE,
  member_name TEXT NOT NULL,
  class_date DATE NOT NULL,
  coach_name TEXT NOT NULL,
  sa_working_shift TEXT NOT NULL,
  fitness_goal TEXT,
  lead_source TEXT NOT NULL,
  linked_ig_lead_id UUID REFERENCES public.ig_leads(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create intros run table
CREATE TABLE public.intros_run (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  shift_recap_id UUID REFERENCES public.shift_recaps(id) ON DELETE CASCADE,
  member_name TEXT NOT NULL,
  class_time TIME NOT NULL,
  booking_source TEXT,
  process_checklist TEXT[],
  lead_measures TEXT[],
  result TEXT NOT NULL,
  notes TEXT,
  is_self_gen BOOLEAN DEFAULT false,
  claimed_by_ig_lead_id UUID REFERENCES public.ig_leads(id) ON DELETE SET NULL,
  commission_amount DECIMAL(10,2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create sales outside intro table
CREATE TABLE public.sales_outside_intro (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  shift_recap_id UUID REFERENCES public.shift_recaps(id) ON DELETE CASCADE,
  member_name TEXT NOT NULL,
  lead_source TEXT NOT NULL,
  membership_type TEXT NOT NULL,
  commission_amount DECIMAL(10,2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create sync log table for Google Sheets
CREATE TABLE public.sheets_sync_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sync_type TEXT NOT NULL,
  records_synced INTEGER DEFAULT 0,
  status TEXT NOT NULL CHECK (status IN ('pending', 'success', 'failed')),
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables (public access for this MVP since no auth)
ALTER TABLE public.staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ig_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shift_recaps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.intros_booked ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.intros_run ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_outside_intro ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sheets_sync_log ENABLE ROW LEVEL SECURITY;

-- Create public access policies (MVP - no auth required)
CREATE POLICY "Allow public read access" ON public.staff FOR SELECT USING (true);
CREATE POLICY "Allow public read access" ON public.ig_leads FOR SELECT USING (true);
CREATE POLICY "Allow public insert access" ON public.ig_leads FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access" ON public.ig_leads FOR UPDATE USING (true);
CREATE POLICY "Allow public delete access" ON public.ig_leads FOR DELETE USING (true);

CREATE POLICY "Allow public read access" ON public.shift_recaps FOR SELECT USING (true);
CREATE POLICY "Allow public insert access" ON public.shift_recaps FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access" ON public.shift_recaps FOR UPDATE USING (true);

CREATE POLICY "Allow public read access" ON public.intros_booked FOR SELECT USING (true);
CREATE POLICY "Allow public insert access" ON public.intros_booked FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public read access" ON public.intros_run FOR SELECT USING (true);
CREATE POLICY "Allow public insert access" ON public.intros_run FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public read access" ON public.sales_outside_intro FOR SELECT USING (true);
CREATE POLICY "Allow public insert access" ON public.sales_outside_intro FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public read access" ON public.sheets_sync_log FOR SELECT USING (true);
CREATE POLICY "Allow public insert access" ON public.sheets_sync_log FOR INSERT WITH CHECK (true);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for ig_leads updated_at
CREATE TRIGGER update_ig_leads_updated_at
  BEFORE UPDATE ON public.ig_leads
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();