
-- Drop the unique constraint temporarily so we can do the bulk update,
-- then handle collisions by appending a counter suffix, then re-add it.
ALTER TABLE intro_questionnaires DROP CONSTRAINT IF EXISTS idx_intro_questionnaires_slug;
DROP INDEX IF EXISTS idx_intro_questionnaires_slug;

-- First pass: set base slug for all rows with a class date
UPDATE intro_questionnaires
SET slug =
  regexp_replace(lower(client_first_name), '[^a-z0-9]', '', 'g')
  || '-' ||
  regexp_replace(lower(client_last_name), '[^a-z0-9]', '', 'g')
  || '-' ||
  lower(to_char(scheduled_class_date, 'MonDD'))
WHERE scheduled_class_date IS NOT NULL;

-- Second pass: for rows without a class date
UPDATE intro_questionnaires
SET slug =
  regexp_replace(lower(client_first_name), '[^a-z0-9]', '', 'g')
  || '-' ||
  regexp_replace(lower(client_last_name), '[^a-z0-9]', '', 'g')
WHERE scheduled_class_date IS NULL;

-- Third pass: deduplicate by appending row-number suffix (skip the first occurrence of each slug)
WITH ranked AS (
  SELECT id, slug,
    ROW_NUMBER() OVER (PARTITION BY slug ORDER BY created_at) AS rn
  FROM intro_questionnaires
)
UPDATE intro_questionnaires q
SET slug = ranked.slug || '-' || ranked.rn
FROM ranked
WHERE q.id = ranked.id AND ranked.rn > 1;

-- Recreate the unique index
CREATE UNIQUE INDEX idx_intro_questionnaires_slug ON intro_questionnaires (slug) WHERE slug IS NOT NULL;
