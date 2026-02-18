-- Backfill existing intro_questionnaires slugs to the new firstname-lastname-uuid format.
-- Only updates rows where the slug does NOT already contain the record's own id (idempotent).
UPDATE intro_questionnaires
SET slug =
  regexp_replace(lower(client_first_name), '[^a-z0-9]', '', 'g')
  || CASE
       WHEN regexp_replace(lower(client_last_name), '[^a-z0-9]', '', 'g') != ''
       THEN '-' || regexp_replace(lower(client_last_name), '[^a-z0-9]', '', 'g')
       ELSE ''
     END
  || '-' ||
  id::text
WHERE slug NOT LIKE '%' || id::text || '%'
   OR slug IS NULL;

-- RPC function for the admin backfill button (safe to call repeatedly)
CREATE OR REPLACE FUNCTION public.backfill_questionnaire_slugs()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated int;
BEGIN
  UPDATE intro_questionnaires
  SET slug =
    regexp_replace(lower(client_first_name), '[^a-z0-9]', '', 'g')
    || CASE
         WHEN regexp_replace(lower(client_last_name), '[^a-z0-9]', '', 'g') != ''
         THEN '-' || regexp_replace(lower(client_last_name), '[^a-z0-9]', '', 'g')
         ELSE ''
       END
    || '-' ||
    id::text
  WHERE slug NOT LIKE '%' || id::text || '%'
     OR slug IS NULL;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN json_build_object('updated', v_updated);
END;
$$;