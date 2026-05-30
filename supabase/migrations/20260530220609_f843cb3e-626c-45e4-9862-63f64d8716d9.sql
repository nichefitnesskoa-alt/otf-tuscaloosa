UPDATE public.intros_booked
SET booking_status_canon = 'DELETED_SOFT'
WHERE deleted_at IS NOT NULL
  AND booking_status_canon <> 'DELETED_SOFT';