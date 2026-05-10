-- Add reflection_text column for Level 1 self-eval reflection prompts
ALTER TABLE public.fv_scorecards ADD COLUMN IF NOT EXISTS reflection_text text;

-- Update fv_scorecard_notify to include self-vs-formal gap in formal eval notifications
CREATE OR REPLACE FUNCTION public.fv_scorecard_notify()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_subject_name text;
  v_should_notify boolean := false;
  v_self_score int;
  v_gap int;
  v_title text;
  v_body text;
BEGIN
  IF TG_OP = 'INSERT' AND NEW.submitted_at IS NOT NULL THEN
    v_should_notify := true;
  ELSIF TG_OP = 'UPDATE' AND OLD.submitted_at IS NULL AND NEW.submitted_at IS NOT NULL THEN
    v_should_notify := true;
  END IF;

  IF NOT v_should_notify THEN
    RETURN NEW;
  END IF;

  v_subject_name := COALESCE(NEW.practice_name,
    (SELECT member_name FROM intros_booked WHERE id = NEW.first_timer_id),
    'an intro');

  IF NEW.eval_type = 'self_eval' THEN
    INSERT INTO notifications (notification_type, title, body, target_user, meta)
    VALUES ('fv_self_eval_submitted',
            NEW.evaluatee_name || ' submitted a self-evaluation',
            v_subject_name || ' — Level ' || NEW.level || ' (' || NEW.total_score || '/30)',
            'Koa',
            jsonb_build_object('scorecard_id', NEW.id, 'level', NEW.level));
  ELSIF NEW.eval_type = 'formal_eval' THEN
    -- Look up an existing self-eval for the same intro to compute the gap
    v_self_score := NULL;
    IF NEW.first_timer_id IS NOT NULL THEN
      SELECT total_score INTO v_self_score
      FROM fv_scorecards
      WHERE first_timer_id = NEW.first_timer_id
        AND eval_type = 'self_eval'
        AND submitted_at IS NOT NULL
        AND id <> NEW.id
      ORDER BY submitted_at DESC
      LIMIT 1;
    END IF;

    IF v_self_score IS NOT NULL THEN
      v_gap := abs(NEW.total_score - v_self_score);
      v_title := 'Formal eval landed — ' || v_gap || '-point gap from your self-eval';
      v_body := v_subject_name || ' — Level ' || NEW.level || ' (' || NEW.total_score || '/30). Tap to see what landed and what didn''t.';
    ELSE
      v_title := NEW.evaluator_name || ' evaluated your first visit';
      v_body := v_subject_name || ' — Level ' || NEW.level || ' (' || NEW.total_score || '/30)';
    END IF;

    INSERT INTO notifications (notification_type, title, body, target_user, meta)
    VALUES ('fv_formal_eval_received',
            v_title,
            v_body,
            NEW.evaluatee_name,
            jsonb_build_object(
              'scorecard_id', NEW.id,
              'level', NEW.level,
              'gap', v_gap,
              'self_score', v_self_score
            ));
  END IF;

  IF NEW.level = 3 THEN
    INSERT INTO notifications (notification_type, title, body, target_user, meta)
    VALUES ('fv_level_3_landed',
            'Level 3 just landed',
            NEW.evaluatee_name || ' on ' || v_subject_name,
            'Koa',
            jsonb_build_object('scorecard_id', NEW.id, 'evaluatee', NEW.evaluatee_name, 'subject', v_subject_name));
  END IF;

  RETURN NEW;
END;
$function$;