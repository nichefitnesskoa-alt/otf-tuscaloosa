
-- Standards table
CREATE TABLE public.shift_standards (
  key text PRIMARY KEY,
  title text NOT NULL,
  display_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.shift_standards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all read shift_standards" ON public.shift_standards FOR SELECT USING (true);
CREATE POLICY "Allow all insert shift_standards" ON public.shift_standards FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all update shift_standards" ON public.shift_standards FOR UPDATE USING (true);
CREATE POLICY "Allow all delete shift_standards" ON public.shift_standards FOR DELETE USING (true);

-- Seed
INSERT INTO public.shift_standards (key, title, display_order) VALUES
  ('s1', 'Every intro feels expected, prepared for, and personally welcomed before they walk in.', 1),
  ('s2', 'Every lead interaction feels real and genuine.', 2),
  ('s3', 'Every follow-up moves someone forward. Not just touched. Moved.', 3),
  ('s4', 'Every member interaction counts.', 4),
  ('s5', 'Every piece of equipment is ready before the next person needs it.', 5),
  ('other', 'Other shift duties', 99);

-- Standard key on templates and overrides
ALTER TABLE public.shift_task_templates ADD COLUMN standard_key text NOT NULL DEFAULT 'other';
ALTER TABLE public.shift_task_overrides ADD COLUMN standard_key text NOT NULL DEFAULT 'other';

-- Backfill existing 'standard' shift templates by name
UPDATE public.shift_task_templates SET standard_key = 's1'
  WHERE shift_type = 'standard' AND task_name IN (
    'Name on whiteboard before intros arrive',
    'Booking confirmation and questionnaire sent for today',
    'Read their questionnaire before they walk in — know one thing about them',
    'Name on whiteboard before they arrive',
    'Booking confirmation and questionnaire sent'
  );

UPDATE public.shift_task_templates SET standard_key = 's2'
  WHERE shift_type = 'standard' AND task_name IN (
    'Comment genuinely on posts on feed or people we follow today',
    'Comment genuinely on a post from someone we follow today',
    'IG DMs sent this shift',
    'Lead texts sent this shift — new or cold'
  );

UPDATE public.shift_task_templates SET standard_key = 's3'
  WHERE shift_type = 'standard' AND task_name IN (
    'Follow-up queue worked this shift',
    'At least one person got a real next step — a booking, a date, a real answer'
  );

UPDATE public.shift_task_templates SET standard_key = 's4'
  WHERE shift_type = 'standard' AND task_name IN (
    'Create a connection with a member. Learn something new about them.',
    'Ask a member if they have a friend who wants a free class'
  );

UPDATE public.shift_task_templates SET standard_key = 's5'
  WHERE shift_type = 'standard' AND task_name IN (
    'Milestones checked after every check-in wave — bag prepped before they finish class',
    'Rowers checked and charging if needed — nothing left for the next SA to discover'
  );
