
-- Campaigns table
CREATE TABLE public.campaigns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE,
  offer_description TEXT,
  target_audience TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all read campaigns" ON public.campaigns FOR SELECT USING (true);
CREATE POLICY "Allow all insert campaigns" ON public.campaigns FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all update campaigns" ON public.campaigns FOR UPDATE USING (true);
CREATE POLICY "Allow all delete campaigns" ON public.campaigns FOR DELETE USING (true);

-- Campaign sends junction table
CREATE TABLE public.campaign_sends (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  send_log_id UUID NOT NULL REFERENCES public.script_send_log(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.campaign_sends ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all read campaign_sends" ON public.campaign_sends FOR SELECT USING (true);
CREATE POLICY "Allow all insert campaign_sends" ON public.campaign_sends FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all delete campaign_sends" ON public.campaign_sends FOR DELETE USING (true);

-- Weekly digests table
CREATE TABLE public.weekly_digests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  week_start DATE NOT NULL,
  report_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.weekly_digests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all read weekly_digests" ON public.weekly_digests FOR SELECT USING (true);
CREATE POLICY "Allow all insert weekly_digests" ON public.weekly_digests FOR INSERT WITH CHECK (true);

-- Enable realtime on leads for lead alerts
ALTER PUBLICATION supabase_realtime ADD TABLE public.leads;
