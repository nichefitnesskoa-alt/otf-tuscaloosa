
-- Drop the old restrictive check constraint and replace with one that includes planning_reschedule
ALTER TABLE public.follow_up_queue 
  DROP CONSTRAINT IF EXISTS follow_up_queue_person_type_check;

ALTER TABLE public.follow_up_queue 
  ADD CONSTRAINT follow_up_queue_person_type_check 
  CHECK (person_type = ANY (ARRAY['no_show'::text, 'didnt_buy'::text, 'planning_reschedule'::text]));
