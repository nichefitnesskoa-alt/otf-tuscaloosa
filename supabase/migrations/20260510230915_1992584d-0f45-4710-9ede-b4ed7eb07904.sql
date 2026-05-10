ALTER TABLE public.follow_up_queue DROP CONSTRAINT IF EXISTS follow_up_queue_person_type_check;
ALTER TABLE public.follow_up_queue ADD CONSTRAINT follow_up_queue_person_type_check
  CHECK (person_type = ANY (ARRAY[
    'no_show','didnt_buy','planning_reschedule',
    'book_2nd_intro_day2','book_2nd_intro_day7','planning_to_buy'
  ]));

UPDATE public.follow_up_queue
SET status = 'pending', closed_reason = NULL
WHERE person_type = 'planning_to_buy'
  AND closed_reason LIKE 'Pre-May%';