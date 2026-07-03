-- Singleton current value
CREATE TABLE public.net_gain_state (
  id INT PRIMARY KEY DEFAULT 1,
  value INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by TEXT,
  CONSTRAINT net_gain_state_singleton CHECK (id = 1)
);

GRANT SELECT, INSERT, UPDATE ON public.net_gain_state TO anon, authenticated;
GRANT ALL ON public.net_gain_state TO service_role;
ALTER TABLE public.net_gain_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY "net_gain_state_read" ON public.net_gain_state FOR SELECT TO public USING (true);
CREATE POLICY "net_gain_state_update" ON public.net_gain_state FOR UPDATE TO public USING (true) WITH CHECK (true);
CREATE POLICY "net_gain_state_insert" ON public.net_gain_state FOR INSERT TO public WITH CHECK (true);

INSERT INTO public.net_gain_state (id, value, updated_by)
VALUES (1, 0, 'system')
ON CONFLICT (id) DO NOTHING;

CREATE TRIGGER trg_net_gain_state_updated_at
BEFORE UPDATE ON public.net_gain_state
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Audit log
CREATE TABLE public.net_gain_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  delta INT NOT NULL,
  new_value INT NOT NULL,
  note TEXT,
  changed_by TEXT NOT NULL,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.net_gain_log TO anon, authenticated;
GRANT ALL ON public.net_gain_log TO service_role;
ALTER TABLE public.net_gain_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "net_gain_log_read"   ON public.net_gain_log FOR SELECT TO public USING (true);
CREATE POLICY "net_gain_log_insert" ON public.net_gain_log FOR INSERT TO public WITH CHECK (true);

CREATE INDEX idx_net_gain_log_changed_at ON public.net_gain_log (changed_at DESC);