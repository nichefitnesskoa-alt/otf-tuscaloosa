-- Section 4: DB Indexes for performance
-- followup_touches indexes
CREATE INDEX IF NOT EXISTS idx_followup_touches_booking_id ON public.followup_touches (booking_id);
CREATE INDEX IF NOT EXISTS idx_followup_touches_created_at ON public.followup_touches (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_followup_touches_created_by ON public.followup_touches (created_by);
CREATE INDEX IF NOT EXISTS idx_followup_touches_booking_created ON public.followup_touches (booking_id, created_at DESC);

-- follow_up_queue indexes
CREATE INDEX IF NOT EXISTS idx_follow_up_queue_status_date ON public.follow_up_queue (status, scheduled_date);
CREATE INDEX IF NOT EXISTS idx_follow_up_queue_booking_id ON public.follow_up_queue (booking_id);

-- Section 5A: daily_goal_settings table
CREATE TABLE IF NOT EXISTS public.daily_goal_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  role text NULL,
  touches_target int NOT NULL DEFAULT 25,
  followups_done_target int NOT NULL DEFAULT 10,
  scope text NOT NULL DEFAULT 'global'
);

ALTER TABLE public.daily_goal_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all read daily_goal_settings" ON public.daily_goal_settings FOR SELECT USING (true);
CREATE POLICY "Allow all insert daily_goal_settings" ON public.daily_goal_settings FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all update daily_goal_settings" ON public.daily_goal_settings FOR UPDATE USING (true);
CREATE POLICY "Allow all delete daily_goal_settings" ON public.daily_goal_settings FOR DELETE USING (true);

-- Insert default global settings
INSERT INTO public.daily_goal_settings (role, touches_target, followups_done_target, scope)
VALUES ('SA', 25, 10, 'global')
ON CONFLICT DO NOTHING;
