
-- Table for Win the Day reflection responses (Q outreach, confirmations, new leads)
CREATE TABLE public.win_the_day_reflections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sa_name TEXT NOT NULL,
  reflection_date DATE NOT NULL DEFAULT CURRENT_DATE,
  reflection_type TEXT NOT NULL, -- 'questionnaire_outreach' | 'booking_confirmation' | 'new_leads_contact'
  result TEXT NOT NULL, -- varies by type
  booking_id UUID NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Table for daily follow-up log (contacted/responded counts)
CREATE TABLE public.followup_daily_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sa_name TEXT NOT NULL,
  log_date DATE NOT NULL DEFAULT CURRENT_DATE,
  contacted_count INTEGER NOT NULL DEFAULT 0,
  responded_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(sa_name, log_date)
);

-- RLS policies
ALTER TABLE public.win_the_day_reflections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.followup_daily_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all read win_the_day_reflections" ON public.win_the_day_reflections FOR SELECT USING (true);
CREATE POLICY "Allow all insert win_the_day_reflections" ON public.win_the_day_reflections FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all update win_the_day_reflections" ON public.win_the_day_reflections FOR UPDATE USING (true);
CREATE POLICY "Allow all delete win_the_day_reflections" ON public.win_the_day_reflections FOR DELETE USING (true);

CREATE POLICY "Allow all read followup_daily_log" ON public.followup_daily_log FOR SELECT USING (true);
CREATE POLICY "Allow all insert followup_daily_log" ON public.followup_daily_log FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all update followup_daily_log" ON public.followup_daily_log FOR UPDATE USING (true);
CREATE POLICY "Allow all delete followup_daily_log" ON public.followup_daily_log FOR DELETE USING (true);

-- Enable realtime for reflections
ALTER PUBLICATION supabase_realtime ADD TABLE public.win_the_day_reflections;
ALTER PUBLICATION supabase_realtime ADD TABLE public.followup_daily_log;
