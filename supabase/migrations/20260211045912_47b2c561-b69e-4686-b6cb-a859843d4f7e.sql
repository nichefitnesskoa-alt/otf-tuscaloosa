
-- Create intake_events table for idempotency and audit
CREATE TABLE public.intake_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  source TEXT NOT NULL DEFAULT 'gmail',
  external_id TEXT NOT NULL,
  payload JSONB,
  lead_id UUID,
  booking_id UUID,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT intake_events_external_id_unique UNIQUE (external_id)
);

-- Enable RLS
ALTER TABLE public.intake_events ENABLE ROW LEVEL SECURITY;

-- Open RLS policies (matching existing app pattern)
CREATE POLICY "Allow all read intake_events" ON public.intake_events FOR SELECT USING (true);
CREATE POLICY "Allow all insert intake_events" ON public.intake_events FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all update intake_events" ON public.intake_events FOR UPDATE USING (true);
CREATE POLICY "Allow all delete intake_events" ON public.intake_events FOR DELETE USING (true);
