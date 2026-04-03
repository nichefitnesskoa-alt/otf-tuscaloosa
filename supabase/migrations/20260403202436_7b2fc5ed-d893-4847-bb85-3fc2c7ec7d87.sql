
ALTER TABLE public.follow_up_queue
  ADD COLUMN IF NOT EXISTS owner_role text NOT NULL DEFAULT 'SA',
  ADD COLUMN IF NOT EXISTS coach_owner text,
  ADD COLUMN IF NOT EXISTS transferred_to_sa_at timestamptz,
  ADD COLUMN IF NOT EXISTS not_interested_at timestamptz,
  ADD COLUMN IF NOT EXISTS not_interested_by text,
  ADD COLUMN IF NOT EXISTS closed_reason text;

-- Backfill existing records: missed guests get Coach ownership
UPDATE public.follow_up_queue fq
SET owner_role = 'Coach',
    coach_owner = ir.coach_name
FROM public.intros_run ir
JOIN public.intros_booked ib ON ir.linked_intro_booked_id = ib.id
WHERE fq.booking_id = ib.id
  AND fq.person_type = 'follow_up'
  AND ir.result_canon = 'FOLLOW_UP'
  AND ir.coach_name IS NOT NULL;
