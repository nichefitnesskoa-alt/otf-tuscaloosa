
-- Create meeting_agendas table
CREATE TABLE public.meeting_agendas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_date date NOT NULL,
  date_range_start date NOT NULL,
  date_range_end date NOT NULL,
  metrics_snapshot jsonb DEFAULT '{}'::jsonb,
  manual_shoutouts text,
  housekeeping_notes text,
  wig_commitments text,
  wig_target text,
  drill_override text,
  status text NOT NULL DEFAULT 'draft',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(meeting_date)
);

ALTER TABLE public.meeting_agendas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read meeting_agendas"
  ON public.meeting_agendas FOR SELECT USING (true);

CREATE POLICY "Anyone can insert meeting_agendas"
  ON public.meeting_agendas FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can update meeting_agendas"
  ON public.meeting_agendas FOR UPDATE USING (true);

CREATE POLICY "Anyone can delete meeting_agendas"
  ON public.meeting_agendas FOR DELETE USING (true);

CREATE TRIGGER update_meeting_agendas_updated_at
  BEFORE UPDATE ON public.meeting_agendas
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create meeting_settings table (single-row config)
CREATE TABLE public.meeting_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_day integer NOT NULL DEFAULT 1,
  meeting_time text NOT NULL DEFAULT '10:00 AM',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.meeting_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read meeting_settings"
  ON public.meeting_settings FOR SELECT USING (true);

CREATE POLICY "Anyone can update meeting_settings"
  ON public.meeting_settings FOR UPDATE USING (true);

CREATE POLICY "Anyone can insert meeting_settings"
  ON public.meeting_settings FOR INSERT WITH CHECK (true);

-- Seed with default row
INSERT INTO public.meeting_settings (meeting_day, meeting_time) VALUES (1, '10:00 AM');
