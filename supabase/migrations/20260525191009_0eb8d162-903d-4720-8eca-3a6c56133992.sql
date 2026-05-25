
-- Trigger function: only allow Coach, Both, or Koa as evaluator on fv_scorecards.
CREATE OR REPLACE FUNCTION public.enforce_scorecard_evaluator_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
BEGIN
  IF NEW.evaluator_name IS NULL OR length(trim(NEW.evaluator_name)) = 0 THEN
    RAISE EXCEPTION 'evaluator_name_required';
  END IF;

  -- Koa is always allowed (Admin identity).
  IF NEW.evaluator_name = 'Koa' THEN
    RETURN NEW;
  END IF;

  SELECT role INTO v_role FROM public.staff WHERE name = NEW.evaluator_name LIMIT 1;

  IF v_role IS NULL THEN
    RAISE EXCEPTION 'evaluator_not_in_staff: %', NEW.evaluator_name;
  END IF;

  IF v_role NOT IN ('Coach', 'Both', 'Admin') THEN
    RAISE EXCEPTION 'evaluator_role_not_permitted: % is role %, must be Coach, Both, or Admin', NEW.evaluator_name, v_role;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_scorecard_evaluator_role ON public.fv_scorecards;
CREATE TRIGGER trg_enforce_scorecard_evaluator_role
  BEFORE INSERT OR UPDATE OF evaluator_name ON public.fv_scorecards
  FOR EACH ROW EXECUTE FUNCTION public.enforce_scorecard_evaluator_role();

-- Backfill the two known bad rows. Disable trigger for THIS session-level
-- update so the role check (which would block Kaiya rows) doesn't fire on the
-- old evaluator_name; we're flipping to Koa anyway.
ALTER TABLE public.fv_scorecards DISABLE TRIGGER trg_enforce_scorecard_evaluator_role;

INSERT INTO public.fv_scorecard_edit_log (scorecard_id, editor_name, field_changed, old_value, new_value)
SELECT id, 'System', 'evaluator_name', evaluator_name, 'Koa'
FROM public.fv_scorecards
WHERE id IN ('a5274c81-b8cb-4614-868c-9955c0083d0b', '2238f3de-ace7-4ae5-b93c-a5a5ffe94f5c');

INSERT INTO public.fv_scorecard_edit_log (scorecard_id, editor_name, field_changed, old_value, new_value)
SELECT id, 'System', 'eval_type', eval_type, 'self_eval'
FROM public.fv_scorecards
WHERE id IN ('a5274c81-b8cb-4614-868c-9955c0083d0b', '2238f3de-ace7-4ae5-b93c-a5a5ffe94f5c');

UPDATE public.fv_scorecards
SET evaluator_name = 'Koa', eval_type = 'self_eval'
WHERE id IN ('a5274c81-b8cb-4614-868c-9955c0083d0b', '2238f3de-ace7-4ae5-b93c-a5a5ffe94f5c');

ALTER TABLE public.fv_scorecards ENABLE TRIGGER trg_enforce_scorecard_evaluator_role;
