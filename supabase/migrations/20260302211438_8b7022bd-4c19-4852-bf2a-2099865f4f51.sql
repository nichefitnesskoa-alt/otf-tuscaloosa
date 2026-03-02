
-- 10x Exercise tables
CREATE TABLE public.ten_x_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  goal text NOT NULL,
  session_date date NOT NULL DEFAULT CURRENT_DATE,
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ten_x_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all read ten_x_sessions" ON public.ten_x_sessions FOR SELECT USING (true);
CREATE POLICY "Allow all insert ten_x_sessions" ON public.ten_x_sessions FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all update ten_x_sessions" ON public.ten_x_sessions FOR UPDATE USING (true);
CREATE POLICY "Allow all delete ten_x_sessions" ON public.ten_x_sessions FOR DELETE USING (true);

CREATE TABLE public.ten_x_ideas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.ten_x_sessions(id) ON DELETE CASCADE,
  participant_name text NOT NULL,
  participant_role text NOT NULL DEFAULT 'SA',
  idea_text text NOT NULL DEFAULT '',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ten_x_ideas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all read ten_x_ideas" ON public.ten_x_ideas FOR SELECT USING (true);
CREATE POLICY "Allow all insert ten_x_ideas" ON public.ten_x_ideas FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all update ten_x_ideas" ON public.ten_x_ideas FOR UPDATE USING (true);
CREATE POLICY "Allow all delete ten_x_ideas" ON public.ten_x_ideas FOR DELETE USING (true);

CREATE TRIGGER update_ten_x_ideas_updated_at
  BEFORE UPDATE ON public.ten_x_ideas
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
