
-- Add slug column
ALTER TABLE public.intro_questionnaires ADD COLUMN slug text;

-- Backfill slugs with deduplication using window function
WITH slugs AS (
  SELECT id,
    lower(regexp_replace(regexp_replace(trim(client_first_name || '-' || client_last_name), '[^a-zA-Z0-9-]', '', 'g'), '-+', '-', 'g')) AS base_slug,
    ROW_NUMBER() OVER (
      PARTITION BY lower(regexp_replace(regexp_replace(trim(client_first_name || '-' || client_last_name), '[^a-zA-Z0-9-]', '', 'g'), '-+', '-', 'g'))
      ORDER BY created_at ASC
    ) AS rn
  FROM public.intro_questionnaires
  WHERE client_first_name IS NOT NULL AND client_first_name != ''
)
UPDATE public.intro_questionnaires q
SET slug = CASE WHEN s.rn = 1 THEN s.base_slug ELSE s.base_slug || '-' || s.rn END
FROM slugs s
WHERE q.id = s.id;

-- Now create unique partial index
CREATE UNIQUE INDEX idx_intro_questionnaires_slug ON public.intro_questionnaires (slug) WHERE slug IS NOT NULL;
