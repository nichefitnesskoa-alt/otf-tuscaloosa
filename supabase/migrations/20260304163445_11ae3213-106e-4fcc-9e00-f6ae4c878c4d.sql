
-- Create script_categories table
CREATE TABLE public.script_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  sort_order integer NOT NULL DEFAULT 0,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.script_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all read script_categories" ON public.script_categories FOR SELECT USING (true);
CREATE POLICY "Allow all insert script_categories" ON public.script_categories FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all update script_categories" ON public.script_categories FOR UPDATE USING (true);
CREATE POLICY "Allow all delete script_categories" ON public.script_categories FOR DELETE USING (true);

-- Seed existing categories + Reschedule
INSERT INTO public.script_categories (name, slug, sort_order) VALUES
  ('Booking Confirmations', 'booking_confirmation', 1),
  ('Pre-Class Reminders', 'pre_class_reminder', 2),
  ('No-Show Follow-Up', 'no_show', 3),
  ('Instagram DM', 'ig_dm', 4),
  ('Web Lead Outreach', 'web_lead', 5),
  ('Cold Lead Re-Engagement', 'cold_lead', 6),
  ('Post-Class (Didn''t Close)', 'post_class_no_close', 7),
  ('Post-Class (Joined)', 'post_class_joined', 8),
  ('Referral Ask', 'referral_ask', 9),
  ('Cancel/Freeze Save', 'cancel_freeze', 10),
  ('Promos', 'promo', 11),
  ('Reschedule', 'reschedule', 12);

-- Seed the Reschedule script
INSERT INTO public.script_templates (name, category, channel, body, sequence_order, timing_note)
VALUES (
  'Reschedule — Coach Mention',
  'reschedule',
  'sms',
  'Hey {first-name}! This is {sa-name} from OTF Tuscaloosa. {coach-name} mentioned you after your class and wanted me to reach out. We''d love to get you back in — what does your week look like? I can grab a spot for you right now. 🧡',
  1,
  'Send within 24 hours of class'
);
