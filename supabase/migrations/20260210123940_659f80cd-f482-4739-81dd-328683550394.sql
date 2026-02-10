
-- Create intro_questionnaires table
CREATE TABLE public.intro_questionnaires (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NULL,
  client_first_name text NOT NULL,
  client_last_name text NOT NULL DEFAULT '',
  scheduled_class_date date NOT NULL,
  scheduled_class_time time NULL,
  q1_fitness_goal text NULL,
  q2_fitness_level integer NULL,
  q3_obstacle text NULL,
  q4_past_experience text NULL,
  q5_emotional_driver text NULL,
  q6_weekly_commitment text NULL,
  q7_coach_notes text NULL,
  status text NOT NULL DEFAULT 'not_sent',
  submitted_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.intro_questionnaires ENABLE ROW LEVEL SECURITY;

-- Public SELECT: anyone with the UUID can load it
CREATE POLICY "Public can view questionnaires by id"
ON public.intro_questionnaires FOR SELECT
USING (true);

-- Authenticated INSERT: staff can create questionnaire records
CREATE POLICY "Authenticated users can create questionnaires"
ON public.intro_questionnaires FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

-- Public UPDATE: prospects can submit answers without login
CREATE POLICY "Public can update questionnaires"
ON public.intro_questionnaires FOR UPDATE
USING (true);

-- Admin DELETE only
CREATE POLICY "Admins can delete questionnaires"
ON public.intro_questionnaires FOR DELETE
USING (public.has_role(auth.uid(), 'admin'));
