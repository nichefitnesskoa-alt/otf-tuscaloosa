CREATE TABLE public.sticky_note_acks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  note_id uuid NOT NULL REFERENCES public.sticky_notes(id) ON DELETE CASCADE,
  user_name text NOT NULL,
  acknowledged_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (note_id, user_name)
);

GRANT SELECT, INSERT, DELETE ON public.sticky_note_acks TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.sticky_note_acks TO anon;
GRANT ALL ON public.sticky_note_acks TO service_role;

ALTER TABLE public.sticky_note_acks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff read sticky_note_acks" ON public.sticky_note_acks FOR SELECT USING (true);
CREATE POLICY "staff insert sticky_note_acks" ON public.sticky_note_acks FOR INSERT WITH CHECK (true);
CREATE POLICY "staff delete sticky_note_acks" ON public.sticky_note_acks FOR DELETE USING (true);

CREATE INDEX idx_sticky_note_acks_note ON public.sticky_note_acks(note_id);
CREATE INDEX idx_sticky_note_acks_user ON public.sticky_note_acks(user_name);

ALTER PUBLICATION supabase_realtime ADD TABLE public.sticky_note_acks;