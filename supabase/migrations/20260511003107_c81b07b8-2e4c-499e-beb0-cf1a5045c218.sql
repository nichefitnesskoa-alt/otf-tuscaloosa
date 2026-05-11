CREATE TABLE public.class_milestone_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_date date NOT NULL,
  class_time time NOT NULL,
  checked_by text NOT NULL,
  checked_at timestamptz NOT NULL DEFAULT now(),
  unchecked_at timestamptz,
  unchecked_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (class_date, class_time)
);

ALTER TABLE public.class_milestone_checks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all read class_milestone_checks" ON public.class_milestone_checks FOR SELECT TO public USING (true);
CREATE POLICY "Allow all insert class_milestone_checks" ON public.class_milestone_checks FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Allow all update class_milestone_checks" ON public.class_milestone_checks FOR UPDATE TO public USING (true);
CREATE POLICY "Allow all delete class_milestone_checks" ON public.class_milestone_checks FOR DELETE TO public USING (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.class_milestone_checks;
ALTER TABLE public.class_milestone_checks REPLICA IDENTITY FULL;