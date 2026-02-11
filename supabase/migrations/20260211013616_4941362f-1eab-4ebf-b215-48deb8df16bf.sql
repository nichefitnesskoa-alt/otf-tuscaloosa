
-- Create leads table
CREATE TABLE public.leads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT,
  phone TEXT NOT NULL,
  stage TEXT NOT NULL DEFAULT 'new',
  source TEXT NOT NULL DEFAULT 'Manual Entry',
  lost_reason TEXT,
  follow_up_at TIMESTAMPTZ,
  booked_intro_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all read leads" ON public.leads FOR SELECT USING (true);
CREATE POLICY "Allow all insert leads" ON public.leads FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all update leads" ON public.leads FOR UPDATE USING (true);
CREATE POLICY "Allow all delete leads" ON public.leads FOR DELETE USING (true);

-- Create lead_activities table
CREATE TABLE public.lead_activities (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  activity_type TEXT NOT NULL,
  performed_by TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.lead_activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all read lead_activities" ON public.lead_activities FOR SELECT USING (true);
CREATE POLICY "Allow all insert lead_activities" ON public.lead_activities FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all update lead_activities" ON public.lead_activities FOR UPDATE USING (true);
CREATE POLICY "Allow all delete lead_activities" ON public.lead_activities FOR DELETE USING (true);

-- Add updated_at trigger on leads
CREATE TRIGGER update_leads_updated_at
  BEFORE UPDATE ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
