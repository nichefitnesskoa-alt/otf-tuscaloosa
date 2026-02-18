
CREATE OR REPLACE FUNCTION public.reconcile_questionnaire_statuses()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_updated int := 0;
BEGIN
  UPDATE public.intros_booked b
  SET
    questionnaire_status_canon = 'completed',
    questionnaire_completed_at = COALESCE(
      b.questionnaire_completed_at,
      (SELECT q.submitted_at
       FROM public.intro_questionnaires q
       WHERE q.booking_id = b.id
         AND q.status IN ('completed', 'submitted')
       ORDER BY q.submitted_at DESC NULLS LAST
       LIMIT 1)
    )
  WHERE b.questionnaire_status_canon IN ('not_sent', 'sent')
    AND EXISTS (
      SELECT 1
      FROM public.intro_questionnaires q
      WHERE q.booking_id = b.id
        AND q.status IN ('completed', 'submitted')
    );
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN json_build_object('updated', v_updated);
END;
$$;
