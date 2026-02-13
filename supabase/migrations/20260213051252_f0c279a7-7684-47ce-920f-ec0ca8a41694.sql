
-- Follow-up queue table for structured cadence tracking (Part 6)
CREATE TABLE public.follow_up_queue (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  booking_id uuid REFERENCES public.intros_booked(id) ON DELETE SET NULL,
  lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  person_name text NOT NULL,
  person_type text NOT NULL CHECK (person_type IN ('no_show', 'didnt_buy')),
  trigger_date date NOT NULL,
  touch_number integer NOT NULL DEFAULT 1,
  scheduled_date date NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'snoozed', 'skipped', 'dormant', 'converted')),
  sent_by text,
  sent_at timestamp with time zone,
  snoozed_until date,
  is_vip boolean NOT NULL DEFAULT false,
  primary_objection text,
  fitness_goal text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.follow_up_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all read follow_up_queue" ON public.follow_up_queue FOR SELECT USING (true);
CREATE POLICY "Allow all insert follow_up_queue" ON public.follow_up_queue FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all update follow_up_queue" ON public.follow_up_queue FOR UPDATE USING (true);
CREATE POLICY "Allow all delete follow_up_queue" ON public.follow_up_queue FOR DELETE USING (true);

CREATE INDEX idx_follow_up_queue_scheduled ON public.follow_up_queue(scheduled_date, status);
CREATE INDEX idx_follow_up_queue_booking ON public.follow_up_queue(booking_id);
CREATE INDEX idx_follow_up_queue_person ON public.follow_up_queue(person_name);
