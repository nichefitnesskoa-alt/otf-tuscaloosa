
CREATE OR REPLACE FUNCTION public.backfill_questionnaire_slugs()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v1 int;
  v2 int;
BEGIN
  -- Pass 1: rows with a class date → firstname-lastname-mmmdd
  UPDATE intro_questionnaires
  SET slug =
    regexp_replace(lower(client_first_name), '[^a-z0-9]', '', 'g')
    || '-' ||
    regexp_replace(lower(client_last_name), '[^a-z0-9]', '', 'g')
    || '-' ||
    lower(to_char(scheduled_class_date, 'MonDD'))
  WHERE scheduled_class_date IS NOT NULL
    AND (
      slug IS NULL
      OR slug ~ '-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      OR slug ~ '^[0-9a-f]{8}-[0-9a-f]{4}-'
    );
  GET DIAGNOSTICS v1 = ROW_COUNT;

  -- Pass 2: rows without a class date → firstname-lastname
  UPDATE intro_questionnaires
  SET slug =
    regexp_replace(lower(client_first_name), '[^a-z0-9]', '', 'g')
    || '-' ||
    regexp_replace(lower(client_last_name), '[^a-z0-9]', '', 'g')
  WHERE scheduled_class_date IS NULL
    AND (
      slug IS NULL
      OR slug ~ '-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      OR slug ~ '^[0-9a-f]{8}-[0-9a-f]{4}-'
    );
  GET DIAGNOSTICS v2 = ROW_COUNT;

  -- Pass 3: deduplicate by appending counter suffix for collisions
  WITH ranked AS (
    SELECT id, slug,
      ROW_NUMBER() OVER (PARTITION BY slug ORDER BY created_at) AS rn
    FROM intro_questionnaires
  )
  UPDATE intro_questionnaires q
  SET slug = ranked.slug || '-' || ranked.rn
  FROM ranked
  WHERE q.id = ranked.id AND ranked.rn > 1;

  RETURN json_build_object('updated', v1 + v2);
END;
$$;
