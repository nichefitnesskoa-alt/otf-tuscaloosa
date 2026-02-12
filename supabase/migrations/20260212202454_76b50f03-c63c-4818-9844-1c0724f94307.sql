
-- Create vip_sessions table for multi-session support per VIP group
CREATE TABLE public.vip_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  vip_class_name TEXT NOT NULL,
  session_label TEXT,
  session_date DATE,
  session_time TIME WITHOUT TIME ZONE,
  capacity INTEGER NOT NULL DEFAULT 36,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.vip_sessions ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Allow all read vip_sessions" ON public.vip_sessions FOR SELECT USING (true);
CREATE POLICY "Allow all insert vip_sessions" ON public.vip_sessions FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all update vip_sessions" ON public.vip_sessions FOR UPDATE USING (true);
CREATE POLICY "Allow all delete vip_sessions" ON public.vip_sessions FOR DELETE USING (true);

-- Add session reference to intros_booked
ALTER TABLE public.intros_booked ADD COLUMN vip_session_id UUID REFERENCES public.vip_sessions(id);
