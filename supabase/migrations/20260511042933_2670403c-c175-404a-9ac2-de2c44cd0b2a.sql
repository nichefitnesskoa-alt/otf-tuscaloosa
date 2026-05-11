
-- 1. shift_submissions table
CREATE TABLE IF NOT EXISTS public.shift_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sa_name text NOT NULL,
  shift_date date NOT NULL DEFAULT CURRENT_DATE,
  shift_type text NOT NULL,
  lead_forward_answer text,
  member_experience_answer text,
  ownership_lane_answer text,
  submitted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (sa_name, shift_date, shift_type)
);

ALTER TABLE public.shift_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all read shift_submissions" ON public.shift_submissions FOR SELECT USING (true);
CREATE POLICY "Allow all insert shift_submissions" ON public.shift_submissions FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all update shift_submissions" ON public.shift_submissions FOR UPDATE USING (true);
CREATE POLICY "Allow all delete shift_submissions" ON public.shift_submissions FOR DELETE USING (true);

CREATE TRIGGER trg_shift_submissions_updated_at
BEFORE UPDATE ON public.shift_submissions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. referral_asks table
CREATE TABLE IF NOT EXISTS public.referral_asks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sa_name text NOT NULL,
  member_name text NOT NULL,
  friend_name text,
  asked_at timestamptz NOT NULL DEFAULT now(),
  shift_date date,
  shift_type text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_referral_asks_member_name_lower
  ON public.referral_asks (lower(member_name));
CREATE INDEX IF NOT EXISTS idx_referral_asks_asked_at
  ON public.referral_asks (asked_at DESC);

ALTER TABLE public.referral_asks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all read referral_asks" ON public.referral_asks FOR SELECT USING (true);
CREATE POLICY "Allow all insert referral_asks" ON public.referral_asks FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all update referral_asks" ON public.referral_asks FOR UPDATE USING (true);
CREATE POLICY "Allow all delete referral_asks" ON public.referral_asks FOR DELETE USING (true);

-- 3. Reseed shift_task_templates
-- Soft-disable everything that's currently active so old completions stay valid
UPDATE public.shift_task_templates SET is_active = false WHERE is_active = true;

-- Clear count_target on every template (no targets shown)
UPDATE public.shift_task_templates SET count_target = NULL;

-- Insert the new 5-standard task set for all four shift types
DO $$
DECLARE
  shift text;
  shifts text[] := ARRAY['morning','mid','last','weekend'];
BEGIN
  FOREACH shift IN ARRAY shifts LOOP
    -- Standard 1
    INSERT INTO public.shift_task_templates (shift_type, task_order, task_name, has_count, count_label, count_target, is_active)
    VALUES
      (shift, 10, 'Name on whiteboard before they arrive', false, NULL, NULL, true),
      (shift, 11, 'Booking confirmation and questionnaire sent', false, NULL, NULL, true),
      (shift, 12, 'Read their questionnaire before they walk in — know one thing about them', false, NULL, NULL, true),
    -- Standard 2
      (shift, 20, 'Comment genuinely on a post from someone we follow today', false, NULL, NULL, true),
      (shift, 21, 'IG DMs sent this shift', true, 'DMs sent', NULL, true),
      (shift, 22, 'Lead texts sent this shift — new or cold', true, 'Texts sent', NULL, true),
    -- Standard 3
      (shift, 30, 'Follow-up queue worked this shift', false, NULL, NULL, true),
      (shift, 31, 'At least one person got a real next step — a booking, a date, a real answer', false, NULL, NULL, true),
    -- Standard 4
      (shift, 40, 'Create a connection with a member. Learn something new about them.', false, NULL, NULL, true),
      (shift, 41, 'Ask a member if they have a friend who wants a free class', false, NULL, NULL, true),
    -- Standard 5
      (shift, 50, 'Milestones checked after every check-in wave — bag prepped before they finish class', false, NULL, NULL, true),
      (shift, 51, 'Rowers checked and charging if needed — nothing left for the next SA to discover', false, NULL, NULL, true);
  END LOOP;
END $$;

-- 4. Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.shift_submissions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.referral_asks;
