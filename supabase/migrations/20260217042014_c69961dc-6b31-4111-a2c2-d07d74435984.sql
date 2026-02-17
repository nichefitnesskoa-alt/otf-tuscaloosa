
-- Create followup_touches table for durable touch tracking
CREATE TABLE IF NOT EXISTS public.followup_touches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by text NOT NULL,
  booking_id uuid NULL REFERENCES public.intros_booked(id) ON DELETE SET NULL,
  run_id uuid NULL REFERENCES public.intros_run(id) ON DELETE SET NULL,
  lead_id uuid NULL REFERENCES public.leads(id) ON DELETE SET NULL,
  touch_type text NOT NULL,
  script_template_id uuid NULL REFERENCES public.script_templates(id) ON DELETE SET NULL,
  channel text NULL,
  notes text NULL,
  meta jsonb NULL
);

-- Indexes
CREATE INDEX idx_followup_touches_booking_id ON public.followup_touches(booking_id);
CREATE INDEX idx_followup_touches_created_at ON public.followup_touches(created_at);
CREATE INDEX idx_followup_touches_created_by ON public.followup_touches(created_by);
CREATE INDEX idx_followup_touches_touch_type ON public.followup_touches(touch_type);

-- RLS (permissive, consistent with existing tables)
ALTER TABLE public.followup_touches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all read followup_touches" ON public.followup_touches FOR SELECT USING (true);
CREATE POLICY "Allow all insert followup_touches" ON public.followup_touches FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all update followup_touches" ON public.followup_touches FOR UPDATE USING (true);
CREATE POLICY "Allow all delete followup_touches" ON public.followup_touches FOR DELETE USING (true);

-- Add unique constraint on follow_up_queue to prevent duplicate entries
-- Using booking_id + touch_number + person_type as the dedup key
ALTER TABLE public.follow_up_queue ADD CONSTRAINT follow_up_queue_booking_touch_unique
  UNIQUE (booking_id, touch_number, person_type);
