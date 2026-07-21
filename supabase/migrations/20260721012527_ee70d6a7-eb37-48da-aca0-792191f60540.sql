
DROP TRIGGER IF EXISTS trg_sticky_notes_auto_ack_self ON public.sticky_notes;
DROP TRIGGER IF EXISTS sticky_notes_auto_ack_self ON public.sticky_notes;
DROP FUNCTION IF EXISTS public.sticky_notes_auto_ack_self() CASCADE;

ALTER TABLE public.sticky_notes DROP CONSTRAINT IF EXISTS sticky_notes_priority_check;
UPDATE public.sticky_notes SET priority = CASE priority
  WHEN 'low' THEN 'normal'
  WHEN 'medium' THEN 'normal'
  WHEN 'high' THEN 'important'
  WHEN 'urgent' THEN 'urgent'
  ELSE 'normal'
END;
ALTER TABLE public.sticky_notes ALTER COLUMN priority SET DEFAULT 'normal';
ALTER TABLE public.sticky_notes
  ADD CONSTRAINT sticky_notes_priority_check
  CHECK (priority IN ('normal','important','urgent'));

DROP INDEX IF EXISTS idx_sticky_notes_assigned_status;
ALTER TABLE public.sticky_notes DROP CONSTRAINT IF EXISTS sticky_notes_status_check;
ALTER TABLE public.sticky_notes DROP COLUMN IF EXISTS status;
CREATE INDEX IF NOT EXISTS idx_sticky_notes_assigned_ack ON public.sticky_notes (assigned_to, acknowledged_at);

CREATE OR REPLACE FUNCTION public.sticky_notes_auto_ack_self()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.assigned_to = NEW.created_by AND NEW.acknowledged_at IS NULL THEN
    NEW.acknowledged_at := now();
    NEW.acknowledged_by := NEW.created_by;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_sticky_notes_auto_ack_self
BEFORE INSERT ON public.sticky_notes
FOR EACH ROW EXECUTE FUNCTION public.sticky_notes_auto_ack_self();

ALTER TABLE public.team_chat_messages RENAME COLUMN author TO sender;
