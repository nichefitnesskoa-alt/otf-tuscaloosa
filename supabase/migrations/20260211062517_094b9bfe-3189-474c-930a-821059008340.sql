
-- Script Templates table
CREATE TABLE public.script_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category text NOT NULL,
  channel text NOT NULL DEFAULT 'sms',
  sequence_order integer,
  body text NOT NULL DEFAULT '',
  timing_note text,
  is_shared_step boolean NOT NULL DEFAULT false,
  shared_step_id uuid REFERENCES public.script_templates(id) ON DELETE SET NULL,
  is_active boolean NOT NULL DEFAULT true,
  variant_label text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Script Send Log table
CREATE TABLE public.script_send_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES public.script_templates(id) ON DELETE CASCADE,
  lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  booking_id uuid REFERENCES public.intros_booked(id) ON DELETE SET NULL,
  sent_by text NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  message_body_sent text NOT NULL,
  sequence_step_number integer
);

-- Enable RLS
ALTER TABLE public.script_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.script_send_log ENABLE ROW LEVEL SECURITY;

-- Public access policies (matching existing app pattern)
CREATE POLICY "Allow all read script_templates" ON public.script_templates FOR SELECT USING (true);
CREATE POLICY "Allow all insert script_templates" ON public.script_templates FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all update script_templates" ON public.script_templates FOR UPDATE USING (true);
CREATE POLICY "Allow all delete script_templates" ON public.script_templates FOR DELETE USING (true);

CREATE POLICY "Allow all read script_send_log" ON public.script_send_log FOR SELECT USING (true);
CREATE POLICY "Allow all insert script_send_log" ON public.script_send_log FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all update script_send_log" ON public.script_send_log FOR UPDATE USING (true);
CREATE POLICY "Allow all delete script_send_log" ON public.script_send_log FOR DELETE USING (true);

-- Trigger for updated_at
CREATE TRIGGER update_script_templates_updated_at
  BEFORE UPDATE ON public.script_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Seed templates
INSERT INTO public.script_templates (name, category, channel, body, timing_note) VALUES
  ('1A: 1st Intro Booking Confirmation', 'booking_confirmation', 'sms',
   'Hey {first-name}! This is {sa-name} from Orangetheory Tuscaloosa! I''m so excited to have you coming in for your intro class on {day} at {time}! Before your class, please fill out this quick questionnaire so your coach can personalize your workout: {questionnaire-link}. See you {today/tomorrow}! 🧡',
   'Send immediately after booking');

INSERT INTO public.script_templates (name, category, channel, sequence_order, body, timing_note) VALUES
  ('3A: No-Show Initial', 'no_show', 'sms', 1,
   'Hey {first-name}! This is {sa-name} from OTF Tuscaloosa. We missed you at your intro class today! No worries at all — life happens. I''d love to get you rescheduled. What day works best for you this week?',
   'Send same day as no-show');

INSERT INTO public.script_templates (name, category, channel, sequence_order, body, timing_note) VALUES
  ('4A: IG DM Opener', 'ig_dm', 'dm', 1,
   'Hey {first-name}! I saw you were checking out OTF Tuscaloosa — have you ever tried a class before? 🧡',
   'Send within 24 hours of follow/engagement');
