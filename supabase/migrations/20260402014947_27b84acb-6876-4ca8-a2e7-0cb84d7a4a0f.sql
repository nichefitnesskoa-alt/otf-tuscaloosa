
-- Milestones table
CREATE TABLE public.milestones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_type text NOT NULL CHECK (entry_type IN ('milestone', 'deploy')),
  member_name text NOT NULL,
  milestone_type text,
  five_class_pack_gifted boolean NOT NULL DEFAULT false,
  friend_name text,
  friend_contact text,
  converted_to_lead_id uuid REFERENCES public.leads(id),
  deploy_item_given text,
  deploy_converted boolean NOT NULL DEFAULT false,
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.milestones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all read milestones" ON public.milestones FOR SELECT TO public USING (true);
CREATE POLICY "Allow all insert milestones" ON public.milestones FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Allow all update milestones" ON public.milestones FOR UPDATE TO public USING (true);
CREATE POLICY "Allow all delete milestones" ON public.milestones FOR DELETE TO public USING (true);

-- Milestone summary view (current quarter)
CREATE OR REPLACE VIEW public.milestone_summary AS
WITH quarter_bounds AS (
  SELECT
    date_trunc('quarter', CURRENT_DATE)::date AS q_start,
    (date_trunc('quarter', CURRENT_DATE) + interval '3 months' - interval '1 day')::date AS q_end
)
SELECT
  COUNT(*) FILTER (WHERE m.entry_type = 'milestone') AS total_milestones_celebrated,
  COUNT(*) FILTER (WHERE m.milestone_type ILIKE '%birthday%') AS total_birthdays,
  COUNT(*) FILTER (WHERE m.five_class_pack_gifted = true) AS total_packs_gifted,
  COUNT(*) FILTER (WHERE m.converted_to_lead_id IS NOT NULL) AS total_friends_added_to_pipeline,
  COUNT(*) FILTER (WHERE m.entry_type = 'deploy') AS total_deployed,
  COUNT(*) FILTER (WHERE m.deploy_converted = true) AS total_deploy_converted
FROM public.milestones m, quarter_bounds q
WHERE m.created_at::date BETWEEN q.q_start AND q.q_end;
