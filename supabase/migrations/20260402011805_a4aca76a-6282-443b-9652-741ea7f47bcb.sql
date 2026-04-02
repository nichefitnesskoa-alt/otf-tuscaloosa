
-- Table: shift_task_templates
CREATE TABLE public.shift_task_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_type text NOT NULL,
  task_order integer NOT NULL,
  task_name text NOT NULL,
  has_count boolean NOT NULL DEFAULT false,
  count_label text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.shift_task_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all read shift_task_templates" ON public.shift_task_templates FOR SELECT TO public USING (true);
CREATE POLICY "Allow all insert shift_task_templates" ON public.shift_task_templates FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Allow all update shift_task_templates" ON public.shift_task_templates FOR UPDATE TO public USING (true);
CREATE POLICY "Allow all delete shift_task_templates" ON public.shift_task_templates FOR DELETE TO public USING (true);

-- Table: shift_task_completions
CREATE TABLE public.shift_task_completions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sa_name text NOT NULL,
  shift_date date NOT NULL DEFAULT CURRENT_DATE,
  shift_type text NOT NULL,
  task_template_id uuid REFERENCES public.shift_task_templates(id) ON DELETE SET NULL,
  override_id uuid,
  completed boolean NOT NULL DEFAULT false,
  count_logged integer,
  completed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.shift_task_completions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all read shift_task_completions" ON public.shift_task_completions FOR SELECT TO public USING (true);
CREATE POLICY "Allow all insert shift_task_completions" ON public.shift_task_completions FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Allow all update shift_task_completions" ON public.shift_task_completions FOR UPDATE TO public USING (true);
CREATE POLICY "Allow all delete shift_task_completions" ON public.shift_task_completions FOR DELETE TO public USING (true);

-- Table: shift_task_overrides
CREATE TABLE public.shift_task_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_type text NOT NULL,
  active_date date NOT NULL,
  task_name text NOT NULL,
  has_count boolean NOT NULL DEFAULT false,
  count_label text,
  created_by text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.shift_task_overrides ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all read shift_task_overrides" ON public.shift_task_overrides FOR SELECT TO public USING (true);
CREATE POLICY "Allow all insert shift_task_overrides" ON public.shift_task_overrides FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Allow all update shift_task_overrides" ON public.shift_task_overrides FOR UPDATE TO public USING (true);
CREATE POLICY "Allow all delete shift_task_overrides" ON public.shift_task_overrides FOR DELETE TO public USING (true);

-- Seed data: Morning
INSERT INTO public.shift_task_templates (shift_type, task_order, task_name, has_count, count_label) VALUES
  ('morning', 1, 'Send IG DMs', true, 'DMs sent'),
  ('morning', 2, 'Check milestones — message group chat', false, null),
  ('morning', 3, 'Confirm booked 1st intros for the day', false, null),
  ('morning', 4, 'Intro no-show follow-up texts', false, null),
  ('morning', 5, 'Get social media content', false, null);

-- Seed data: Mid
INSERT INTO public.shift_task_templates (shift_type, task_order, task_name, has_count, count_label) VALUES
  ('mid', 1, 'Confirm booked 1st intros for evening classes', false, null),
  ('mid', 2, 'Text lead management — leads within 60 days', true, 'Texts sent'),
  ('mid', 3, 'Intro no-show follow-up texts', false, null),
  ('mid', 4, 'Send DMs', true, 'DMs sent'),
  ('mid', 5, 'Missed guests — intro didn''t buy', false, null);

-- Seed data: Last
INSERT INTO public.shift_task_templates (shift_type, task_order, task_name, has_count, count_label) VALUES
  ('last', 1, 'Confirm booked 1st intros for the morning', false, null),
  ('last', 2, 'Send cold lead text messages', true, 'Texts sent'),
  ('last', 3, 'Intro no-show follow-up texts', false, null),
  ('last', 4, 'Send DMs', true, 'DMs sent');

-- Seed data: Weekend
INSERT INTO public.shift_task_templates (shift_type, task_order, task_name, has_count, count_label) VALUES
  ('weekend', 1, 'Confirm booked 1st intros for the morning', false, null),
  ('weekend', 2, 'Intro no-show follow-up texts', false, null),
  ('weekend', 3, 'Send DMs', true, 'DMs sent'),
  ('weekend', 4, 'Lead management texts', true, 'Texts sent'),
  ('weekend', 5, 'Message group chat for morning shift milestones', false, null);
