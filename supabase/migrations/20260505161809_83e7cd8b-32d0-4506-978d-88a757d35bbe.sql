
-- Drop dependent view first (unused in app code, replaced by scorecard system)
DROP VIEW IF EXISTS public.coach_wig_summary CASCADE;

-- =========================================================================
-- PART 1: Archive old coach lead measure data
-- =========================================================================

CREATE TABLE IF NOT EXISTS public.archived_first_timer_lead_measures_legacy (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid,
  run_id uuid,
  coach_name text,
  member_name text,
  class_date date,
  shoutout_consent boolean,
  coach_shoutout_start boolean,
  coach_shoutout_end boolean,
  coach_brief_why_moment text,
  coach_member_pair_plan text,
  goal_why_captured text,
  made_a_friend boolean,
  relationship_experience text,
  original_booking_created_at timestamptz,
  original_run_created_at timestamptz,
  archived_at timestamptz not null default now(),
  archive_reason text not null default 'Replaced by First Visit Experience Scorecard system'
);

ALTER TABLE public.archived_first_timer_lead_measures_legacy ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all read archive" ON public.archived_first_timer_lead_measures_legacy FOR SELECT USING (true);
CREATE POLICY "Allow all insert archive" ON public.archived_first_timer_lead_measures_legacy FOR INSERT WITH CHECK (true);

INSERT INTO public.archived_first_timer_lead_measures_legacy
  (booking_id, coach_name, member_name, class_date,
   shoutout_consent, coach_shoutout_start, coach_shoutout_end,
   coach_brief_why_moment, coach_member_pair_plan,
   original_booking_created_at)
SELECT id, coach_name, member_name, class_date,
       shoutout_consent, coach_shoutout_start, coach_shoutout_end,
       coach_brief_why_moment, coach_member_pair_plan,
       created_at
FROM public.intros_booked
WHERE shoutout_consent IS NOT NULL
   OR coach_shoutout_start IS NOT NULL
   OR coach_shoutout_end IS NOT NULL
   OR coach_brief_why_moment IS NOT NULL
   OR coach_member_pair_plan IS NOT NULL;

INSERT INTO public.archived_first_timer_lead_measures_legacy
  (booking_id, run_id, coach_name, member_name, class_date,
   goal_why_captured, made_a_friend, relationship_experience,
   original_run_created_at)
SELECT linked_intro_booked_id, id, coach_name, member_name, run_date,
       goal_why_captured, made_a_friend, relationship_experience,
       created_at
FROM public.intros_run
WHERE goal_why_captured IS NOT NULL
   OR made_a_friend IS NOT NULL
   OR relationship_experience IS NOT NULL;

-- =========================================================================
-- PART 2: Drop legacy columns
-- =========================================================================

ALTER TABLE public.intros_booked
  DROP COLUMN IF EXISTS shoutout_consent,
  DROP COLUMN IF EXISTS coach_shoutout_start,
  DROP COLUMN IF EXISTS coach_shoutout_end,
  DROP COLUMN IF EXISTS coach_brief_why_moment,
  DROP COLUMN IF EXISTS coach_member_pair_plan;

ALTER TABLE public.intros_run
  DROP COLUMN IF EXISTS goal_why_captured,
  DROP COLUMN IF EXISTS made_a_friend,
  DROP COLUMN IF EXISTS relationship_experience;

-- =========================================================================
-- PART 3: Scorecard tables
-- =========================================================================

CREATE TABLE public.fv_scorecards (
  id uuid primary key default gen_random_uuid(),
  first_timer_id uuid,
  is_practice boolean not null default false,
  practice_name text,
  evaluator_name text not null,
  evaluatee_name text not null,
  eval_type text not null check (eval_type in ('self_eval', 'formal_eval')),
  class_type text not null check (class_type in ('orange_60_2g', 'orange_60_3g', 'strength_and_tread_50')),
  class_date date not null,
  member_count integer,
  tread_score integer not null default 0 check (tread_score between 0 and 6),
  rower_score integer not null default 0 check (rower_score between 0 and 6),
  floor_score integer not null default 0 check (floor_score between 0 and 6),
  otbeat_score integer not null default 0 check (otbeat_score between 0 and 6),
  handback_score integer not null default 0 check (handback_score between 0 and 6),
  total_score integer generated always as (tread_score + rower_score + floor_score + otbeat_score + handback_score) stored,
  level integer generated always as (
    CASE
      WHEN (tread_score + rower_score + floor_score + otbeat_score + handback_score) >= 21 THEN 3
      WHEN (tread_score + rower_score + floor_score + otbeat_score + handback_score) >= 11 THEN 2
      ELSE 1
    END
  ) stored,
  interactions_notes text,
  otbeat_notes text,
  handback_notes text,
  submitted_at timestamptz,
  created_by text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  CONSTRAINT subject_xor CHECK (
    (first_timer_id IS NOT NULL AND is_practice = false AND practice_name IS NULL)
    OR (first_timer_id IS NULL AND is_practice = true AND practice_name IS NOT NULL AND length(btrim(practice_name)) > 0)
  )
);

CREATE INDEX idx_fv_scorecards_first_timer ON public.fv_scorecards(first_timer_id);
CREATE INDEX idx_fv_scorecards_evaluatee ON public.fv_scorecards(evaluatee_name);
CREATE INDEX idx_fv_scorecards_class_date ON public.fv_scorecards(class_date);
CREATE INDEX idx_fv_scorecards_eval_type ON public.fv_scorecards(eval_type);

ALTER TABLE public.fv_scorecards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all read fv_scorecards" ON public.fv_scorecards FOR SELECT USING (true);
CREATE POLICY "Allow all insert fv_scorecards" ON public.fv_scorecards FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all update fv_scorecards" ON public.fv_scorecards FOR UPDATE USING (true);

CREATE TABLE public.fv_scorecard_bullets (
  id uuid primary key default gen_random_uuid(),
  scorecard_id uuid not null references public.fv_scorecards(id) on delete cascade,
  column_key text not null check (column_key in ('tread', 'rower', 'floor', 'otbeat', 'handback')),
  bullet_key text not null,
  score integer not null check (score in (0, 1, 2)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  UNIQUE (scorecard_id, bullet_key)
);

CREATE INDEX idx_fv_bullets_scorecard ON public.fv_scorecard_bullets(scorecard_id);

ALTER TABLE public.fv_scorecard_bullets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all read fv_bullets" ON public.fv_scorecard_bullets FOR SELECT USING (true);
CREATE POLICY "Allow all insert fv_bullets" ON public.fv_scorecard_bullets FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all update fv_bullets" ON public.fv_scorecard_bullets FOR UPDATE USING (true);
CREATE POLICY "Allow all delete fv_bullets" ON public.fv_scorecard_bullets FOR DELETE USING (true);

CREATE TABLE public.fv_scorecard_comments (
  id uuid primary key default gen_random_uuid(),
  scorecard_id uuid not null references public.fv_scorecards(id) on delete cascade,
  author_name text not null,
  body text not null,
  created_by text not null,
  created_at timestamptz not null default now()
);

CREATE INDEX idx_fv_comments_scorecard ON public.fv_scorecard_comments(scorecard_id);

ALTER TABLE public.fv_scorecard_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all read fv_comments" ON public.fv_scorecard_comments FOR SELECT USING (true);
CREATE POLICY "Allow all insert fv_comments" ON public.fv_scorecard_comments FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all update fv_comments" ON public.fv_scorecard_comments FOR UPDATE USING (true);

CREATE TABLE public.fv_scorecard_edit_log (
  id uuid primary key default gen_random_uuid(),
  scorecard_id uuid not null references public.fv_scorecards(id) on delete cascade,
  editor_name text not null,
  field_changed text not null,
  old_value text,
  new_value text,
  edited_at timestamptz not null default now()
);

CREATE INDEX idx_fv_edit_log_scorecard ON public.fv_scorecard_edit_log(scorecard_id);

ALTER TABLE public.fv_scorecard_edit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all read fv_edit_log" ON public.fv_scorecard_edit_log FOR SELECT USING (true);
CREATE POLICY "Allow all insert fv_edit_log" ON public.fv_scorecard_edit_log FOR INSERT WITH CHECK (true);

-- =========================================================================
-- PART 4: Triggers
-- =========================================================================

CREATE TRIGGER trg_fv_scorecards_updated_at
  BEFORE UPDATE ON public.fv_scorecards
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_fv_bullets_updated_at
  BEFORE UPDATE ON public.fv_scorecard_bullets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.fv_scorecard_notify()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_subject_name text;
  v_should_notify boolean := false;
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
    INSERT INTO notifications (notification_type, title, body, target_user, meta)
    VALUES ('fv_formal_eval_received',
            NEW.evaluator_name || ' evaluated your first visit',
            v_subject_name || ' — Level ' || NEW.level || ' (' || NEW.total_score || '/30)',
            NEW.evaluatee_name,
            jsonb_build_object('scorecard_id', NEW.id, 'level', NEW.level));
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
$$;

CREATE TRIGGER trg_fv_scorecard_notify
  AFTER INSERT OR UPDATE ON public.fv_scorecards
  FOR EACH ROW EXECUTE FUNCTION public.fv_scorecard_notify();

CREATE OR REPLACE FUNCTION public.fv_scorecard_log_edits()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_editor text := COALESCE(NEW.created_by, 'system');
BEGIN
  IF NEW.tread_score IS DISTINCT FROM OLD.tread_score THEN
    INSERT INTO fv_scorecard_edit_log (scorecard_id, editor_name, field_changed, old_value, new_value)
    VALUES (NEW.id, v_editor, 'tread_score', OLD.tread_score::text, NEW.tread_score::text);
  END IF;
  IF NEW.rower_score IS DISTINCT FROM OLD.rower_score THEN
    INSERT INTO fv_scorecard_edit_log (scorecard_id, editor_name, field_changed, old_value, new_value)
    VALUES (NEW.id, v_editor, 'rower_score', OLD.rower_score::text, NEW.rower_score::text);
  END IF;
  IF NEW.floor_score IS DISTINCT FROM OLD.floor_score THEN
    INSERT INTO fv_scorecard_edit_log (scorecard_id, editor_name, field_changed, old_value, new_value)
    VALUES (NEW.id, v_editor, 'floor_score', OLD.floor_score::text, NEW.floor_score::text);
  END IF;
  IF NEW.otbeat_score IS DISTINCT FROM OLD.otbeat_score THEN
    INSERT INTO fv_scorecard_edit_log (scorecard_id, editor_name, field_changed, old_value, new_value)
    VALUES (NEW.id, v_editor, 'otbeat_score', OLD.otbeat_score::text, NEW.otbeat_score::text);
  END IF;
  IF NEW.handback_score IS DISTINCT FROM OLD.handback_score THEN
    INSERT INTO fv_scorecard_edit_log (scorecard_id, editor_name, field_changed, old_value, new_value)
    VALUES (NEW.id, v_editor, 'handback_score', OLD.handback_score::text, NEW.handback_score::text);
  END IF;
  IF NEW.interactions_notes IS DISTINCT FROM OLD.interactions_notes THEN
    INSERT INTO fv_scorecard_edit_log (scorecard_id, editor_name, field_changed, old_value, new_value)
    VALUES (NEW.id, v_editor, 'interactions_notes', OLD.interactions_notes, NEW.interactions_notes);
  END IF;
  IF NEW.otbeat_notes IS DISTINCT FROM OLD.otbeat_notes THEN
    INSERT INTO fv_scorecard_edit_log (scorecard_id, editor_name, field_changed, old_value, new_value)
    VALUES (NEW.id, v_editor, 'otbeat_notes', OLD.otbeat_notes, NEW.otbeat_notes);
  END IF;
  IF NEW.handback_notes IS DISTINCT FROM OLD.handback_notes THEN
    INSERT INTO fv_scorecard_edit_log (scorecard_id, editor_name, field_changed, old_value, new_value)
    VALUES (NEW.id, v_editor, 'handback_notes', OLD.handback_notes, NEW.handback_notes);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_fv_scorecard_log_edits
  AFTER UPDATE ON public.fv_scorecards
  FOR EACH ROW EXECUTE FUNCTION public.fv_scorecard_log_edits();

CREATE OR REPLACE FUNCTION public.fv_comment_notify()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_evaluator text;
  v_evaluatee text;
  v_subject text;
  v_target text;
BEGIN
  SELECT evaluator_name, evaluatee_name,
         COALESCE(practice_name, (SELECT member_name FROM intros_booked WHERE id = first_timer_id), 'a scorecard')
    INTO v_evaluator, v_evaluatee, v_subject
  FROM fv_scorecards WHERE id = NEW.scorecard_id;

  IF NEW.author_name = v_evaluatee THEN
    v_target := v_evaluator;
  ELSE
    v_target := v_evaluatee;
  END IF;

  IF v_target IS NOT NULL AND v_target <> NEW.author_name THEN
    INSERT INTO notifications (notification_type, title, body, target_user, meta)
    VALUES ('fv_scorecard_comment',
            NEW.author_name || ' commented on a scorecard',
            v_subject || ': ' || left(NEW.body, 80),
            v_target,
            jsonb_build_object('scorecard_id', NEW.scorecard_id));
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_fv_comment_notify
  AFTER INSERT ON public.fv_scorecard_comments
  FOR EACH ROW EXECUTE FUNCTION public.fv_comment_notify();

-- =========================================================================
-- PART 5: Realtime + studio settings
-- =========================================================================

ALTER PUBLICATION supabase_realtime ADD TABLE public.fv_scorecards;
ALTER PUBLICATION supabase_realtime ADD TABLE public.fv_scorecard_bullets;
ALTER PUBLICATION supabase_realtime ADD TABLE public.fv_scorecard_comments;

INSERT INTO public.studio_settings (setting_key, setting_value, updated_by)
VALUES ('fv_monthly_l3_target', '6', 'migration')
ON CONFLICT (setting_key) DO NOTHING;
