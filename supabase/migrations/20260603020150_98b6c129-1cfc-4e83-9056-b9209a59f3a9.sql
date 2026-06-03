-- Re-mark 3 mis-categorized intros: NOT_INTERESTED → NO_SHOW + dismissed.
-- They were forced to "Not interested" because there was no way to retire
-- a no-show from follow-up without changing the outcome. With the new
-- follow-up-only disposition the correct state is NO_SHOW + dismissed.
-- Targets: Siena Warriner, Jenna Nygaard, Elise Jurkovic — May 4 2026
-- VIP-class intros currently visible in Koa's Coached drilldown.

UPDATE public.intros_run
SET
  result = 'No-show',
  result_canon = 'NO_SHOW',
  buy_date = NULL,
  commission_amount = 0,
  last_edited_at = now(),
  last_edited_by = 'system-backfill',
  edit_reason = 'Backfill: no-show + resolved-no-follow-up disposition'
WHERE linked_intro_booked_id IN (
  SELECT id FROM public.intros_booked
  WHERE member_name IN ('Siena Warriner','Jenna Nygaard','Elise Jurkovic')
    AND class_date = '2026-05-04'
    AND booking_status_canon = 'NOT_INTERESTED'
);

UPDATE public.intros_booked
SET
  booking_status = 'No-Show',
  booking_status_canon = 'NO_SHOW',
  closed_at = NULL,
  closed_by = NULL,
  followup_dismissed_at = now(),
  last_edited_at = now(),
  last_edited_by = 'system-backfill',
  edit_reason = 'Backfill: no-show + resolved-no-follow-up disposition'
WHERE member_name IN ('Siena Warriner','Jenna Nygaard','Elise Jurkovic')
  AND class_date = '2026-05-04'
  AND booking_status_canon = 'NOT_INTERESTED';

DELETE FROM public.follow_up_queue
WHERE booking_id IN (
  SELECT id FROM public.intros_booked
  WHERE member_name IN ('Siena Warriner','Jenna Nygaard','Elise Jurkovic')
    AND class_date = '2026-05-04'
);