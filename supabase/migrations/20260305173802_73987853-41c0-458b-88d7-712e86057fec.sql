
-- Candidates table
CREATE TABLE public.candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  email text NOT NULL,
  phone text NOT NULL,
  role text NOT NULL,
  stage text NOT NULL DEFAULT 'applied',
  decision text,
  decision_date timestamptz,
  video_url text,
  belonging_essay text,
  future_resume text,
  application_notes text,
  three_step_complete boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Unique constraint on email to prevent duplicates
CREATE UNIQUE INDEX candidates_email_unique ON public.candidates (email);

ALTER TABLE public.candidates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can insert candidates" ON public.candidates FOR INSERT WITH CHECK (true);
CREATE POLICY "Authenticated can read candidates" ON public.candidates FOR SELECT USING (true);
CREATE POLICY "Authenticated can update candidates" ON public.candidates FOR UPDATE USING (true);
CREATE POLICY "Authenticated can delete candidates" ON public.candidates FOR DELETE USING (true);

-- Candidate interviews table
CREATE TABLE public.candidate_interviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id uuid NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,
  question_set_type text NOT NULL DEFAULT 'standard',
  q1_answer text,
  q1_score integer,
  q2_answer text,
  q2_score integer,
  q3_answer text,
  q3_score integer,
  q4_answer text,
  q4_score integer,
  overall_score numeric(3,1),
  overall_notes text,
  interviewed_by text,
  interviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.candidate_interviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read candidate_interviews" ON public.candidate_interviews FOR SELECT USING (true);
CREATE POLICY "Authenticated can insert candidate_interviews" ON public.candidate_interviews FOR INSERT WITH CHECK (true);
CREATE POLICY "Authenticated can update candidate_interviews" ON public.candidate_interviews FOR UPDATE USING (true);
CREATE POLICY "Authenticated can delete candidate_interviews" ON public.candidate_interviews FOR DELETE USING (true);

-- Candidate history table
CREATE TABLE public.candidate_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id uuid NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,
  action text NOT NULL,
  performed_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.candidate_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read candidate_history" ON public.candidate_history FOR SELECT USING (true);
CREATE POLICY "Authenticated can insert candidate_history" ON public.candidate_history FOR INSERT WITH CHECK (true);

-- Storage bucket for candidate videos
INSERT INTO storage.buckets (id, name, public) VALUES ('candidate-videos', 'candidate-videos', true);

-- Allow public uploads to candidate-videos bucket
CREATE POLICY "Public can upload candidate videos" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'candidate-videos');
CREATE POLICY "Public can read candidate videos" ON storage.objects FOR SELECT USING (bucket_id = 'candidate-videos');
