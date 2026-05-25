-- Backfill: rescheduled bookings should not be linked via originating_booking_id
-- (that field is reserved for true 2nd intros). They keep rebooked_from_booking_id.
UPDATE public.intros_booked
SET originating_booking_id = NULL,
    last_edited_at = now(),
    last_edited_by = COALESCE(last_edited_by, 'System (reschedule backfill)'),
    edit_reason = 'Backfill: cleared originating_booking_id on reschedule'
WHERE rebooked_from_booking_id IS NOT NULL
  AND originating_booking_id IS NOT NULL
  AND (rebook_reason IS NULL OR rebook_reason <> 'second_intro');

-- Mark the superseded originals so they stop counting toward denominators.
UPDATE public.intros_booked
SET booking_status_canon = 'RESCHEDULED',
    ignore_from_metrics = true,
    last_edited_at = now(),
    last_edited_by = COALESCE(last_edited_by, 'System (reschedule backfill)'),
    edit_reason = 'Backfill: superseded by reschedule'
WHERE id IN (
  SELECT DISTINCT rebooked_from_booking_id
  FROM public.intros_booked
  WHERE rebooked_from_booking_id IS NOT NULL
    AND (rebook_reason IS NULL OR rebook_reason <> 'second_intro')
)
AND booking_status_canon NOT IN ('RESCHEDULED', 'DELETED_SOFT');