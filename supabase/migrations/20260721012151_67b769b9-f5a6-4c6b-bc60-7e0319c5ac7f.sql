
-- Sticky Notes + Team Chat tables
CREATE TABLE public.sticky_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content text NOT NULL,
  created_by text NOT NULL,
  assigned_to text NOT NULL,
  due_date date,
  priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('low','medium','high','urgent')),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','acknowledged','done')),
  acknowledged_at timestamptz,
  acknowledged_by text,
  completed_at timestamptz,
  completed_by text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sticky_notes TO anon, authenticated;
GRANT ALL ON public.sticky_notes TO service_role;
ALTER TABLE public.sticky_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read sticky_notes" ON public.sticky_notes FOR SELECT USING (true);
CREATE POLICY "staff insert sticky_notes" ON public.sticky_notes FOR INSERT WITH CHECK (true);
CREATE POLICY "staff update sticky_notes" ON public.sticky_notes FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "staff delete sticky_notes" ON public.sticky_notes FOR DELETE USING (true);
CREATE INDEX idx_sticky_notes_assigned_status ON public.sticky_notes(assigned_to, status);

-- Auto-acknowledge self-notes on insert
CREATE OR REPLACE FUNCTION public.sticky_notes_auto_ack_self()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.assigned_to = NEW.created_by AND NEW.status = 'open' THEN
    NEW.status := 'acknowledged';
    NEW.acknowledged_at := now();
    NEW.acknowledged_by := NEW.created_by;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_sticky_notes_auto_ack_self
  BEFORE INSERT ON public.sticky_notes
  FOR EACH ROW EXECUTE FUNCTION public.sticky_notes_auto_ack_self();

CREATE TABLE public.sticky_note_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  note_id uuid NOT NULL REFERENCES public.sticky_notes(id) ON DELETE CASCADE,
  author text NOT NULL,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sticky_note_comments TO anon, authenticated;
GRANT ALL ON public.sticky_note_comments TO service_role;
ALTER TABLE public.sticky_note_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read sticky_note_comments" ON public.sticky_note_comments FOR SELECT USING (true);
CREATE POLICY "staff insert sticky_note_comments" ON public.sticky_note_comments FOR INSERT WITH CHECK (true);
CREATE POLICY "staff update sticky_note_comments" ON public.sticky_note_comments FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "staff delete sticky_note_comments" ON public.sticky_note_comments FOR DELETE USING (true);
CREATE INDEX idx_sticky_note_comments_note_id ON public.sticky_note_comments(note_id);

CREATE TABLE public.team_chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author text NOT NULL,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.team_chat_messages TO anon, authenticated;
GRANT ALL ON public.team_chat_messages TO service_role;
ALTER TABLE public.team_chat_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read team_chat_messages" ON public.team_chat_messages FOR SELECT USING (true);
CREATE POLICY "staff insert team_chat_messages" ON public.team_chat_messages FOR INSERT WITH CHECK (true);
CREATE POLICY "staff update team_chat_messages" ON public.team_chat_messages FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "staff delete team_chat_messages" ON public.team_chat_messages FOR DELETE USING (true);
CREATE INDEX idx_team_chat_messages_created_at ON public.team_chat_messages(created_at DESC);

-- Enable Realtime for live updates on all three tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.sticky_notes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.sticky_note_comments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.team_chat_messages;
