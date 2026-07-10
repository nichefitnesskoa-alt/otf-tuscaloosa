
-- 1) Extend events table to support general outreach activities (no date required)
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS activity_type text NOT NULL DEFAULT 'event';

ALTER TABLE public.events
  DROP CONSTRAINT IF EXISTS events_activity_type_check;
ALTER TABLE public.events
  ADD CONSTRAINT events_activity_type_check
  CHECK (activity_type IN ('event', 'general_outreach'));

-- Make event_date nullable so general_outreach rows don't need a date
ALTER TABLE public.events ALTER COLUMN event_date DROP NOT NULL;

-- Trigger enforces: date required for type='event', forbidden-blank for general_outreach ok either way
CREATE OR REPLACE FUNCTION public.enforce_event_date_by_activity_type()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.activity_type = 'event' AND NEW.event_date IS NULL THEN
    RAISE EXCEPTION 'event_date is required when activity_type = ''event''';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_event_date_by_activity_type ON public.events;
CREATE TRIGGER trg_enforce_event_date_by_activity_type
  BEFORE INSERT OR UPDATE ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.enforce_event_date_by_activity_type();

-- 2) Rename existing 'Event' lead_source values to new canonical label
UPDATE public.intros_booked SET lead_source = 'Event / Self Generated Lead' WHERE lead_source = 'Event';
UPDATE public.intros_run    SET lead_source = 'Event / Self Generated Lead' WHERE lead_source = 'Event';
UPDATE public.leads         SET source      = 'Event / Self Generated Lead' WHERE source = 'Event';
UPDATE public.sales_outside_intro SET lead_source = 'Event / Self Generated Lead' WHERE lead_source = 'Event';
