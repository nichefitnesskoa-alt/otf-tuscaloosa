
-- Create script_actions table for tracking action completions (Part 5 prep + Part 10 needs)
CREATE TABLE public.script_actions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  booking_id uuid REFERENCES public.intros_booked(id) ON DELETE SET NULL,
  lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  action_type text NOT NULL, -- script_sent, q_sent, phone_copied, intro_logged
  script_category text, -- which script category was sent
  completed_by text NOT NULL,
  completed_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.script_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all read script_actions" ON public.script_actions FOR SELECT USING (true);
CREATE POLICY "Allow all insert script_actions" ON public.script_actions FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all update script_actions" ON public.script_actions FOR UPDATE USING (true);
CREATE POLICY "Allow all delete script_actions" ON public.script_actions FOR DELETE USING (true);

-- Create index for fast lookups by booking
CREATE INDEX idx_script_actions_booking ON public.script_actions(booking_id);
CREATE INDEX idx_script_actions_date ON public.script_actions(completed_at);
