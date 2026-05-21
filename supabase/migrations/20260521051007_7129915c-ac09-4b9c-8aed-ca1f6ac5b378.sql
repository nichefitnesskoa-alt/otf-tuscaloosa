CREATE OR REPLACE FUNCTION public.process_own_it_mentions(p_text text, p_source_type text, p_source_id uuid, p_meeting_id uuid, p_source_owner_id uuid, p_tagger text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_candidates record;
  v_token text;
  v_lower text;
  v_excerpt text;
  v_pos int;
  v_found boolean;
BEGIN
  IF p_text IS NULL OR btrim(p_text) = '' THEN RETURN; END IF;

  CREATE TEMP TABLE IF NOT EXISTS _candidates (
    token text,
    resolved_name text,
    matched_lane text,
    priority int,
    token_len int
  ) ON COMMIT DROP;
  TRUNCATE TABLE _candidates;

  INSERT INTO _candidates (token, resolved_name, matched_lane, priority, token_len)
  SELECT s.name, s.name, NULL, 1, length(s.name)
  FROM public.staff s WHERE s.is_active = true;

  INSERT INTO _candidates (token, resolved_name, matched_lane, priority, token_len)
  SELECT o.lane_name, o.display_name, o.lane_name, 2, length(o.lane_name)
  FROM public.table_owners o
  WHERE o.is_active = true AND o.lane_name IS NOT NULL AND btrim(o.lane_name) <> '';

  v_lower := lower(p_text);

  FOR v_candidates IN
    SELECT DISTINCT ON (token, resolved_name) token, resolved_name, matched_lane, priority, token_len
    FROM _candidates
    ORDER BY token, resolved_name, priority, token_len DESC
  LOOP
    v_pos := position('@' || lower(v_candidates.token) IN v_lower);
    IF v_pos > 0 THEN
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
$function$;