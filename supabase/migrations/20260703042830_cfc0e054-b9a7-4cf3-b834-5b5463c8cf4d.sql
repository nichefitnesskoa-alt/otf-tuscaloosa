
-- 1. Extend net_gain_log with source tracking for idempotency
ALTER TABLE public.net_gain_log
  ADD COLUMN IF NOT EXISTS source_type text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS source_id text;

CREATE UNIQUE INDEX IF NOT EXISTS net_gain_log_source_unique
  ON public.net_gain_log(source_type, source_id)
  WHERE source_type <> 'manual' AND source_id IS NOT NULL;

-- 2. Planned churns table
CREATE TABLE IF NOT EXISTS public.net_gain_churns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_name text NOT NULL,
  churn_date date NOT NULL,
  notes text,
  applied_at timestamptz,
  upload_batch_id uuid,
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.net_gain_churns TO anon, authenticated;
GRANT ALL ON public.net_gain_churns TO service_role;

ALTER TABLE public.net_gain_churns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "net_gain_churns_read"   ON public.net_gain_churns FOR SELECT USING (true);
CREATE POLICY "net_gain_churns_insert" ON public.net_gain_churns FOR INSERT WITH CHECK (true);
CREATE POLICY "net_gain_churns_update" ON public.net_gain_churns FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "net_gain_churns_delete" ON public.net_gain_churns FOR DELETE USING (true);

CREATE INDEX IF NOT EXISTS idx_net_gain_churns_churn_date ON public.net_gain_churns(churn_date);
CREATE INDEX IF NOT EXISTS idx_net_gain_churns_applied ON public.net_gain_churns(applied_at) WHERE applied_at IS NULL;

CREATE TRIGGER trg_net_gain_churns_updated_at
  BEFORE UPDATE ON public.net_gain_churns
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Per-SA SOML goal overrides
CREATE TABLE IF NOT EXISTS public.soml_sa_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sa_name text NOT NULL UNIQUE,
  referrals_goal integer,
  upgrades_goal integer,
  sales_goal integer,
  updated_by text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.soml_sa_goals TO anon, authenticated;
GRANT ALL ON public.soml_sa_goals TO service_role;

ALTER TABLE public.soml_sa_goals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "soml_sa_goals_read"   ON public.soml_sa_goals FOR SELECT USING (true);
CREATE POLICY "soml_sa_goals_insert" ON public.soml_sa_goals FOR INSERT WITH CHECK (true);
CREATE POLICY "soml_sa_goals_update" ON public.soml_sa_goals FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "soml_sa_goals_delete" ON public.soml_sa_goals FOR DELETE USING (true);

CREATE TRIGGER trg_soml_sa_goals_updated_at
  BEFORE UPDATE ON public.soml_sa_goals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. Idempotent Net Gain writer
CREATE OR REPLACE FUNCTION public.net_gain_write_delta(
  p_delta integer,
  p_source_type text,
  p_source_id text,
  p_note text,
  p_changed_by text
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new integer;
BEGIN
  -- Idempotency guard for non-manual sources
  IF p_source_type <> 'manual' AND p_source_id IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM public.net_gain_log
      WHERE source_type = p_source_type AND source_id = p_source_id
    ) THEN
      RETURN NULL;
    END IF;
  END IF;

  UPDATE public.net_gain_state
     SET value = value + p_delta,
         updated_by = COALESCE(p_changed_by, updated_by)
   WHERE id = 1
  RETURNING value INTO v_new;

  IF v_new IS NULL THEN
    INSERT INTO public.net_gain_state (id, value, updated_by)
    VALUES (1, p_delta, p_changed_by)
    RETURNING value INTO v_new;
  END IF;

  INSERT INTO public.net_gain_log (delta, new_value, note, changed_by, source_type, source_id)
  VALUES (p_delta, v_new, p_note, COALESCE(p_changed_by, 'system'), p_source_type, p_source_id);

  RETURN v_new;
END;
$$;

-- 5. Apply pending churns
CREATE OR REPLACE FUNCTION public.apply_pending_net_gain_churns()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row record;
  v_applied int := 0;
  v_today date := (now() AT TIME ZONE 'America/Chicago')::date;
BEGIN
  FOR v_row IN
    SELECT id, member_name, churn_date
    FROM public.net_gain_churns
    WHERE applied_at IS NULL
      AND churn_date < v_today
    ORDER BY churn_date ASC
  LOOP
    PERFORM public.net_gain_write_delta(
      -1,
      'churn',
      v_row.id::text,
      'Auto churn: ' || v_row.member_name || ' (' || to_char(v_row.churn_date, 'Mon DD') || ')',
      'system (churn auto-apply)'
    );
    UPDATE public.net_gain_churns SET applied_at = now() WHERE id = v_row.id;
    v_applied := v_applied + 1;
  END LOOP;
  RETURN json_build_object('applied', v_applied);
END;
$$;

-- 6. Reverse an applied churn on delete
CREATE OR REPLACE FUNCTION public.net_gain_churn_reverse_on_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.applied_at IS NOT NULL THEN
    PERFORM public.net_gain_write_delta(
      1,
      'churn_reversal',
      OLD.id::text,
      'Reversal: churn removed for ' || OLD.member_name,
      'system (churn reversal)'
    );
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_net_gain_churn_reverse ON public.net_gain_churns;
CREATE TRIGGER trg_net_gain_churn_reverse
  AFTER DELETE ON public.net_gain_churns
  FOR EACH ROW EXECUTE FUNCTION public.net_gain_churn_reverse_on_delete();

-- 7. Sale auto-add trigger for intros_run
CREATE OR REPLACE FUNCTION public.net_gain_sync_from_run()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sale_canons text[] := ARRAY['SALE','PREMIER','PREMIER_OTBEAT','ELITE','BASIC'];
  v_was_sale boolean := false;
  v_is_sale  boolean := false;
BEGIN
  IF TG_OP <> 'INSERT' THEN
    v_was_sale := OLD.result_canon IS NOT NULL AND upper(btrim(OLD.result_canon)) = ANY(v_sale_canons);
  END IF;
  IF TG_OP <> 'DELETE' THEN
    v_is_sale := NEW.result_canon IS NOT NULL AND upper(btrim(NEW.result_canon)) = ANY(v_sale_canons);
  END IF;

  IF TG_OP = 'INSERT' AND v_is_sale THEN
    PERFORM public.net_gain_write_delta(
      1, 'sale', 'intros_run:' || NEW.id::text,
      'Auto sale: ' || COALESCE(NEW.member_name, 'intro'),
      'system (sale)'
    );
  ELSIF TG_OP = 'UPDATE' AND NOT v_was_sale AND v_is_sale THEN
    PERFORM public.net_gain_write_delta(
      1, 'sale', 'intros_run:' || NEW.id::text,
      'Auto sale: ' || COALESCE(NEW.member_name, 'intro'),
      'system (sale)'
    );
  ELSIF TG_OP = 'UPDATE' AND v_was_sale AND NOT v_is_sale THEN
    PERFORM public.net_gain_write_delta(
      -1, 'sale_reversal', 'intros_run:' || NEW.id::text,
      'Reversal: sale removed for ' || COALESCE(NEW.member_name, 'intro'),
      'system (sale reversal)'
    );
  ELSIF TG_OP = 'DELETE' AND v_was_sale THEN
    PERFORM public.net_gain_write_delta(
      -1, 'sale_reversal', 'intros_run:' || OLD.id::text,
      'Reversal: sale deleted for ' || COALESCE(OLD.member_name, 'intro'),
      'system (sale reversal)'
    );
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_net_gain_sync_from_run ON public.intros_run;
CREATE TRIGGER trg_net_gain_sync_from_run
  AFTER INSERT OR UPDATE OR DELETE ON public.intros_run
  FOR EACH ROW EXECUTE FUNCTION public.net_gain_sync_from_run();

-- 8. Sale auto-add for sales_outside_intro (any row = a membership sale)
CREATE OR REPLACE FUNCTION public.net_gain_sync_from_outside_sale()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.net_gain_write_delta(
      1, 'sale', 'outside:' || NEW.id::text,
      'Auto outside-intro sale: ' || COALESCE(NEW.member_name, 'member'),
      'system (outside sale)'
    );
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM public.net_gain_write_delta(
      -1, 'sale_reversal', 'outside:' || OLD.id::text,
      'Reversal: outside sale deleted for ' || COALESCE(OLD.member_name, 'member'),
      'system (outside sale reversal)'
    );
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_net_gain_sync_from_outside_sale ON public.sales_outside_intro;
CREATE TRIGGER trg_net_gain_sync_from_outside_sale
  AFTER INSERT OR DELETE ON public.sales_outside_intro
  FOR EACH ROW EXECUTE FUNCTION public.net_gain_sync_from_outside_sale();
