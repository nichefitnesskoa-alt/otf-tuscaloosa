
-- Daily outreach log for cold texts/DMs tracking
CREATE TABLE public.daily_outreach_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  log_date date NOT NULL DEFAULT CURRENT_DATE,
  sa_name text NOT NULL,
  cold_texts_sent integer NOT NULL DEFAULT 0,
  cold_dms_sent integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (log_date, sa_name)
);
ALTER TABLE public.daily_outreach_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all read daily_outreach_log" ON public.daily_outreach_log FOR SELECT USING (true);
CREATE POLICY "Allow all insert daily_outreach_log" ON public.daily_outreach_log FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all update daily_outreach_log" ON public.daily_outreach_log FOR UPDATE USING (true);
CREATE POLICY "Allow all delete daily_outreach_log" ON public.daily_outreach_log FOR DELETE USING (true);

-- Notifications table
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  notification_type text NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  target_user text,
  read_at timestamptz,
  meta jsonb DEFAULT '{}'
);
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all read notifications" ON public.notifications FOR SELECT USING (true);
CREATE POLICY "Allow all insert notifications" ON public.notifications FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all update notifications" ON public.notifications FOR UPDATE USING (true);
CREATE POLICY "Allow all delete notifications" ON public.notifications FOR DELETE USING (true);

-- Changelog tables
CREATE TABLE public.changelog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version text NOT NULL,
  published_at timestamptz NOT NULL DEFAULT now(),
  title text NOT NULL,
  changes jsonb NOT NULL DEFAULT '[]',
  is_active boolean NOT NULL DEFAULT true
);
ALTER TABLE public.changelog ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all read changelog" ON public.changelog FOR SELECT USING (true);
CREATE POLICY "Allow all insert changelog" ON public.changelog FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all update changelog" ON public.changelog FOR UPDATE USING (true);

CREATE TABLE public.changelog_seen (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_name text NOT NULL,
  changelog_id uuid NOT NULL REFERENCES public.changelog(id),
  seen_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_name, changelog_id)
);
ALTER TABLE public.changelog_seen ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all read changelog_seen" ON public.changelog_seen FOR SELECT USING (true);
CREATE POLICY "Allow all insert changelog_seen" ON public.changelog_seen FOR INSERT WITH CHECK (true);

-- Enable realtime for notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
