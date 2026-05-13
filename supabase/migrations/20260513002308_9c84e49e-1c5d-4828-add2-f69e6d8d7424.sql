-- Own It mentions: track @Name and @Lane Owner tags inside owner entries / responses / wins
CREATE TABLE IF NOT EXISTS public.table_mentions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id uuid REFERENCES public.table_meetings(id) ON DELETE CASCADE,
  source_type text NOT NULL CHECK (source_type IN ('entry','response','win')),
  source_id uuid NOT NULL,
  source_owner_id uuid,
  tagged_user_name text NOT NULL,
  tagger_user_name text NOT NULL,
  raw_token text NOT NULL,
  matched_lane text,
  excerpt text,
  acknowledged_at timestamptz,
  responded_at timestamptz,
  created_by text NOT NULL DEFAULT 'system',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_type, source_id, tagged_user_name, raw_token)
);

CREATE INDEX IF NOT EXISTS idx_table_mentions_tagged_user
  ON public.table_mentions (tagged_user_name) WHERE acknowledged_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_table_mentions_meeting ON public.table_mentions (meeting_id);

ALTER TABLE public.table_mentions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all read table_mentions" ON public.table_mentions FOR SELECT USING (true);
CREATE POLICY "Allow all insert table_mentions" ON public.table_mentions FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all update table_mentions" ON public.table_mentions FOR UPDATE USING (true);
CREATE POLICY "Allow all delete table_mentions" ON public.table_mentions FOR DELETE USING (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.table_mentions;
ALTER TABLE public.table_mentions REPLICA IDENTITY FULL;

-- Parse @tokens out of free text, resolving to staff names by name OR by active lane
CREATE OR REPLACE FUNCTION public.process_own_it_mentions(
  p_text text,
  p_source_type text,
  p_source_id uuid,
  p_meeting_id uuid,
  p_source_owner_id uuid,
  p_tagger text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_candidates record;
  v_tokens text[];
  v_token text;
  v_lower text;
  v_excerpt text;
  v_pos int;
  v_found boolean;
BEGIN
  IF p_text IS NULL OR btrim(p_text) = '' THEN RETURN; END IF;

  -- Build longest-first list of candidate tokens with their resolution.
  -- Names beat lane matches when they collide (handled by ORDER BY).
  CREATE TEMP TABLE IF NOT EXISTS _candidates (
    token text,
    resolved_name text,
    matched_lane text,
    priority int,
    token_len int
  ) ON COMMIT DROP;
  DELETE FROM _candidates;

  -- Active staff names (priority 1 = wins)
  INSERT INTO _candidates (token, resolved_name, matched_lane, priority, token_len)
  SELECT s.name, s.name, NULL, 1, length(s.name)
  FROM public.staff s WHERE s.is_active = true;

  -- Active lane names from table_owners (priority 2)
  INSERT INTO _candidates (token, resolved_name, matched_lane, priority, token_len)
  SELECT o.lane_name, o.display_name, o.lane_name, 2, length(o.lane_name)
  FROM public.table_owners o
  WHERE o.is_active = true AND o.lane_name IS NOT NULL AND btrim(o.lane_name) <> '';

  v_lower := lower(p_text);

  -- For each candidate, if "@<token>" appears in the text (case-insensitive),
  -- and there's no higher-priority/longer match at that spot, record it.
  FOR v_candidates IN
    SELECT DISTINCT ON (token, resolved_name) token, resolved_name, matched_lane, priority, token_len
    FROM _candidates
    ORDER BY token, resolved_name, priority, token_len DESC
  LOOP
    v_pos := position('@' || lower(v_candidates.token) IN v_lower);
    IF v_pos > 0 THEN
      -- Check this isn't a partial of a longer existing candidate match by scanning
      -- substring after the token ends — if next char is a letter and a longer
      -- token starting with this prefix exists, skip.
      v_found := EXISTS (
        SELECT 1 FROM _candidates c2
        WHERE c2.token_len > v_candidates.token_len
          AND lower(c2.token) LIKE lower(v_candidates.token) || '%'
          AND position('@' || lower(c2.token) IN v_lower) > 0
      );
      IF NOT v_found THEN
        v_excerpt := substring(p_text, GREATEST(v_pos - 20, 1), 160);
        INSERT INTO public.table_mentions (
          meeting_id, source_type, source_id, source_owner_id,
          tagged_user_name, tagger_user_name, raw_token, matched_lane,
          excerpt, created_by
        )
        VALUES (
          p_meeting_id, p_source_type, p_source_id, p_source_owner_id,
          v_candidates.resolved_name, p_tagger,
          '@' || v_candidates.token, v_candidates.matched_lane,
          v_excerpt, p_tagger
        )
        ON CONFLICT (source_type, source_id, tagged_user_name, raw_token)
        DO UPDATE SET excerpt = EXCLUDED.excerpt;

        -- Notify the tagged person (one bell ping per new mention; the upsert above
        -- only inserts a fresh row when the token wasn't previously stored).
        INSERT INTO public.notifications (notification_type, title, body, target_user, meta)
        SELECT
          'own_it_mention',
          p_tagger || ' tagged you in Own It',
          CASE
            WHEN v_candidates.matched_lane IS NOT NULL
              THEN '@' || v_candidates.token || ' (' || v_candidates.resolved_name || ') — ' || v_excerpt
            ELSE p_tagger || ': ' || v_excerpt
          END,
          v_candidates.resolved_name,
          jsonb_build_object(
            'source_type', p_source_type,
            'source_id', p_source_id,
            'meeting_id', p_meeting_id,
            'raw_token', '@' || v_candidates.token,
            'matched_lane', v_candidates.matched_lane
          )
        WHERE NOT EXISTS (
          SELECT 1 FROM public.notifications n
          WHERE n.notification_type = 'own_it_mention'
            AND n.target_user = v_candidates.resolved_name
            AND (n.meta->>'source_id') = p_source_id::text
            AND (n.meta->>'raw_token') = '@' || v_candidates.token
        );
      END IF;
    END IF;
  END LOOP;
END;
$$;

-- Trigger on owner entries
CREATE OR REPLACE FUNCTION public.trg_table_owner_entries_mentions()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_tagger text;
BEGIN
  v_tagger := COALESCE(
    (SELECT display_name FROM public.table_owners WHERE id = NEW.owner_id),
    NEW.created_by, 'system'
  );
  PERFORM public.process_own_it_mentions(
    COALESCE(NEW.last_week_update,'') || E'\n' ||
    COALESCE(NEW.this_week_focus,'') || E'\n' ||
    COALESCE(NEW.ideas,'') || E'\n' ||
    COALESCE(NEW.ask,''),
    'entry', NEW.id, NEW.meeting_id, NEW.owner_id, v_tagger
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS table_owner_entries_mentions_trg ON public.table_owner_entries;
CREATE TRIGGER table_owner_entries_mentions_trg
AFTER INSERT OR UPDATE OF last_week_update, this_week_focus, ideas, ask
ON public.table_owner_entries
FOR EACH ROW EXECUTE FUNCTION public.trg_table_owner_entries_mentions();

-- Trigger on responses: parse mentions AND mark "responded_at" on any open mention
-- pointing at this entry, then notify the original tagger.
CREATE OR REPLACE FUNCTION public.trg_table_responses_mentions()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_owner_id uuid;
  v_mention record;
BEGIN
  SELECT owner_id INTO v_owner_id FROM public.table_owner_entries WHERE id = NEW.owner_entry_id;

  -- Parse mentions inside the response text
  PERFORM public.process_own_it_mentions(
    NEW.content, 'response', NEW.id, NEW.meeting_id, v_owner_id, NEW.responder_name
  );

  -- Stamp responded_at on entry-level mentions and notify the original taggers
  FOR v_mention IN
    SELECT * FROM public.table_mentions
    WHERE source_type = 'entry'
      AND source_id = NEW.owner_entry_id
      AND responded_at IS NULL
  LOOP
    UPDATE public.table_mentions SET responded_at = now() WHERE id = v_mention.id;
    INSERT INTO public.notifications (notification_type, title, body, target_user, meta)
    VALUES (
      'own_it_mention_responded',
      v_mention.tagged_user_name || ' got a ' || NEW.mode || ' on the entry that mentioned them',
      NEW.responder_name || ' (' || NEW.mode || '): ' || left(NEW.content, 140),
      v_mention.tagger_user_name,
      jsonb_build_object(
        'mention_id', v_mention.id,
        'response_id', NEW.id,
        'mode', NEW.mode,
        'meeting_id', NEW.meeting_id
      )
    );
  END LOOP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS table_responses_mentions_trg ON public.table_responses;
CREATE TRIGGER table_responses_mentions_trg
AFTER INSERT ON public.table_responses
FOR EACH ROW EXECUTE FUNCTION public.trg_table_responses_mentions();

-- Trigger on wins
CREATE OR REPLACE FUNCTION public.trg_table_wins_mentions()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_meeting_id uuid;
BEGIN
  SELECT id INTO v_meeting_id FROM public.table_meetings WHERE meeting_date = NEW.meeting_week LIMIT 1;
  PERFORM public.process_own_it_mentions(
    NEW.content, 'win', NEW.id, v_meeting_id, NEW.owner_id, NEW.owner_name
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS table_wins_mentions_trg ON public.table_wins;
CREATE TRIGGER table_wins_mentions_trg
AFTER INSERT OR UPDATE OF content ON public.table_wins
FOR EACH ROW EXECUTE FUNCTION public.trg_table_wins_mentions();

-- When tagged person acknowledges a mention, notify the original tagger
CREATE OR REPLACE FUNCTION public.trg_table_mentions_acknowledged()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.acknowledged_at IS NOT NULL AND OLD.acknowledged_at IS NULL THEN
    INSERT INTO public.notifications (notification_type, title, body, target_user, meta)
    VALUES (
      'own_it_mention_seen',
      NEW.tagged_user_name || ' saw your tag',
      NEW.tagged_user_name || ' acknowledged: ' || COALESCE(NEW.excerpt, NEW.raw_token),
      NEW.tagger_user_name,
      jsonb_build_object('mention_id', NEW.id, 'meeting_id', NEW.meeting_id)
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS table_mentions_acknowledged_trg ON public.table_mentions;
CREATE TRIGGER table_mentions_acknowledged_trg
AFTER UPDATE OF acknowledged_at ON public.table_mentions
FOR EACH ROW EXECUTE FUNCTION public.trg_table_mentions_acknowledged();