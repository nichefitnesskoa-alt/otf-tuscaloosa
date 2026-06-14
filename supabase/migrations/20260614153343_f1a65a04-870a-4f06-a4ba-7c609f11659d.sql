
CREATE TABLE public.events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  event_date date NOT NULL,
  cost_cents integer,
  is_active boolean NOT NULL DEFAULT true,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.events TO authenticated;
GRANT SELECT ON public.events TO anon;
GRANT ALL ON public.events TO service_role;

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "events read all" ON public.events FOR SELECT USING (true);
CREATE POLICY "events insert all" ON public.events FOR INSERT WITH CHECK (true);
CREATE POLICY "events update all" ON public.events FOR UPDATE USING (true);
CREATE POLICY "events delete all" ON public.events FOR DELETE USING (true);

CREATE TRIGGER trg_events_updated_at
  BEFORE UPDATE ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.intros_booked
  ADD COLUMN event_id uuid REFERENCES public.events(id) ON DELETE SET NULL;

CREATE INDEX idx_intros_booked_event_id ON public.intros_booked(event_id) WHERE event_id IS NOT NULL;
