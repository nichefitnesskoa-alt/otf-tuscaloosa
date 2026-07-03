
CREATE TABLE public.outreach_lists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  campaign_tag text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.outreach_lists TO authenticated;
GRANT ALL ON public.outreach_lists TO service_role;
ALTER TABLE public.outreach_lists ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read outreach_lists" ON public.outreach_lists FOR SELECT USING (true);
CREATE POLICY "staff write outreach_lists" ON public.outreach_lists FOR INSERT WITH CHECK (true);
CREATE POLICY "staff update outreach_lists" ON public.outreach_lists FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "staff delete outreach_lists" ON public.outreach_lists FOR DELETE USING (true);

CREATE TABLE public.outreach_list_rows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id uuid NOT NULL REFERENCES public.outreach_lists(id) ON DELETE CASCADE,
  client_name text NOT NULL,
  email text,
  phone text,
  item text,
  amount numeric,
  worked_out_30d boolean,
  last_30d_count integer,
  latest_workout_date date,
  is_churning boolean NOT NULL DEFAULT false,
  churn_date date,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.outreach_list_rows TO authenticated;
GRANT ALL ON public.outreach_list_rows TO service_role;
ALTER TABLE public.outreach_list_rows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read outreach_list_rows" ON public.outreach_list_rows FOR SELECT USING (true);
CREATE POLICY "staff write outreach_list_rows" ON public.outreach_list_rows FOR INSERT WITH CHECK (true);
CREATE POLICY "staff update outreach_list_rows" ON public.outreach_list_rows FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "staff delete outreach_list_rows" ON public.outreach_list_rows FOR DELETE USING (true);
CREATE INDEX outreach_list_rows_list_id_idx ON public.outreach_list_rows(list_id);
CREATE INDEX outreach_list_rows_churn_idx ON public.outreach_list_rows(list_id, is_churning);

CREATE TABLE public.outreach_row_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  row_id uuid NOT NULL REFERENCES public.outreach_list_rows(id) ON DELETE CASCADE,
  list_id uuid NOT NULL REFERENCES public.outreach_lists(id) ON DELETE CASCADE,
  action_type text NOT NULL CHECK (action_type IN ('texted','in_person','save_attempt')),
  done_by text NOT NULL,
  done_at timestamptz NOT NULL DEFAULT now(),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.outreach_row_actions TO authenticated;
GRANT ALL ON public.outreach_row_actions TO service_role;
ALTER TABLE public.outreach_row_actions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read outreach_row_actions" ON public.outreach_row_actions FOR SELECT USING (true);
CREATE POLICY "staff write outreach_row_actions" ON public.outreach_row_actions FOR INSERT WITH CHECK (true);
CREATE POLICY "staff update outreach_row_actions" ON public.outreach_row_actions FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "staff delete outreach_row_actions" ON public.outreach_row_actions FOR DELETE USING (true);
CREATE INDEX outreach_row_actions_row_id_idx ON public.outreach_row_actions(row_id);
CREATE INDEX outreach_row_actions_list_id_idx ON public.outreach_row_actions(list_id);

CREATE TRIGGER trg_outreach_lists_updated_at BEFORE UPDATE ON public.outreach_lists
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_outreach_list_rows_updated_at BEFORE UPDATE ON public.outreach_list_rows
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.outreach_lists REPLICA IDENTITY FULL;
ALTER TABLE public.outreach_list_rows REPLICA IDENTITY FULL;
ALTER TABLE public.outreach_row_actions REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.outreach_lists;
ALTER PUBLICATION supabase_realtime ADD TABLE public.outreach_list_rows;
ALTER PUBLICATION supabase_realtime ADD TABLE public.outreach_row_actions;
