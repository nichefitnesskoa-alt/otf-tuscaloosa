
-- THE TABLE — owner meeting system
CREATE TABLE public.table_meetings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_date date NOT NULL UNIQUE,
  meeting_time time NOT NULL DEFAULT '13:30',
  status text NOT NULL DEFAULT 'upcoming' CHECK (status IN ('upcoming','live','complete')),
  koa_open_note text,
  created_by text NOT NULL DEFAULT 'system',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.table_owners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id uuid NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
  display_name text NOT NULL,
  lane_name text,
  category text,
  is_active boolean NOT NULL DEFAULT true,
  created_by text NOT NULL DEFAULT 'system',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(staff_id)
);

CREATE TABLE public.table_owner_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id uuid NOT NULL REFERENCES public.table_meetings(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES public.table_owners(id) ON DELETE CASCADE,
  last_week_update text,
  this_week_focus text,
  ideas text,
  ask text,
  submitted_at timestamptz,
  created_by text NOT NULL DEFAULT 'system',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(meeting_id, owner_id)
);

CREATE TABLE public.table_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id uuid NOT NULL REFERENCES public.table_meetings(id) ON DELETE CASCADE,
  owner_entry_id uuid NOT NULL REFERENCES public.table_owner_entries(id) ON DELETE CASCADE,
  responder_staff_id uuid REFERENCES public.staff(id) ON DELETE SET NULL,
  responder_name text NOT NULL,
  mode text NOT NULL CHECK (mode IN ('build','flag','offer')),
  content text NOT NULL,
  created_by text NOT NULL DEFAULT 'system',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.table_action_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id uuid NOT NULL REFERENCES public.table_meetings(id) ON DELETE CASCADE,
  source_response_id uuid REFERENCES public.table_responses(id) ON DELETE SET NULL,
  owner_staff_id uuid NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
  owner_name text NOT NULL,
  description text NOT NULL,
  due_date date NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_progress','done')),
  created_by text NOT NULL DEFAULT 'system',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.table_closes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id uuid NOT NULL UNIQUE REFERENCES public.table_meetings(id) ON DELETE CASCADE,
  koa_close_note text,
  energy_word text,
  wins_selected jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_by text NOT NULL DEFAULT 'system',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.table_wins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid REFERENCES public.table_owners(id) ON DELETE SET NULL,
  owner_name text NOT NULL,
  content text NOT NULL,
  meeting_week date NOT NULL,
  included_in_close boolean NOT NULL DEFAULT false,
  created_by text NOT NULL DEFAULT 'system',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_table_owner_entries_meeting ON public.table_owner_entries(meeting_id);
CREATE INDEX idx_table_owner_entries_owner ON public.table_owner_entries(owner_id);
CREATE INDEX idx_table_responses_meeting ON public.table_responses(meeting_id);
CREATE INDEX idx_table_responses_entry ON public.table_responses(owner_entry_id);
CREATE INDEX idx_table_action_items_meeting ON public.table_action_items(meeting_id);
CREATE INDEX idx_table_action_items_status ON public.table_action_items(status);
CREATE INDEX idx_table_action_items_owner ON public.table_action_items(owner_staff_id);
CREATE INDEX idx_table_wins_week ON public.table_wins(meeting_week);

-- RLS — match the project's public-allow pattern (name-based auth, no Supabase Auth UIDs)
ALTER TABLE public.table_meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.table_owners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.table_owner_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.table_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.table_action_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.table_closes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.table_wins ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY['table_meetings','table_owners','table_owner_entries','table_responses','table_action_items','table_closes','table_wins']) LOOP
    EXECUTE format('CREATE POLICY "Allow all read %1$s" ON public.%1$s FOR SELECT USING (true)', t);
    EXECUTE format('CREATE POLICY "Allow all insert %1$s" ON public.%1$s FOR INSERT WITH CHECK (true)', t);
    EXECUTE format('CREATE POLICY "Allow all update %1$s" ON public.%1$s FOR UPDATE USING (true)', t);
    EXECUTE format('CREATE POLICY "Allow all delete %1$s" ON public.%1$s FOR DELETE USING (true)', t);
  END LOOP;
END $$;

-- updated_at triggers
CREATE TRIGGER trg_table_meetings_updated BEFORE UPDATE ON public.table_meetings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_table_owners_updated BEFORE UPDATE ON public.table_owners FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_table_owner_entries_updated BEFORE UPDATE ON public.table_owner_entries FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_table_action_items_updated BEFORE UPDATE ON public.table_action_items FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_table_closes_updated BEFORE UPDATE ON public.table_closes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Realtime for live response feed
ALTER PUBLICATION supabase_realtime ADD TABLE public.table_responses;
ALTER PUBLICATION supabase_realtime ADD TABLE public.table_owner_entries;
ALTER PUBLICATION supabase_realtime ADD TABLE public.table_meetings;
ALTER PUBLICATION supabase_realtime ADD TABLE public.table_action_items;
