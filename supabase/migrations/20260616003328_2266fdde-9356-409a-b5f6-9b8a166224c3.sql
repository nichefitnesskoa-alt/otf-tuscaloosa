ALTER TABLE public.bingo_players ADD COLUMN IF NOT EXISTS share_slug text;

UPDATE public.bingo_players
SET share_slug = regexp_replace(lower(first_name), '[^a-z0-9]', '', 'g') || '-' || substr(md5(id::text), 1, 5)
WHERE share_slug IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS bingo_players_share_slug_key ON public.bingo_players(share_slug);
CREATE INDEX IF NOT EXISTS bingo_players_phone_normalized_idx ON public.bingo_players(phone_normalized);

ALTER TABLE public.bingo_players ALTER COLUMN share_slug SET NOT NULL;

CREATE OR REPLACE FUNCTION public.bingo_players_set_share_slug()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  base text;
  candidate text;
  n int := 0;
BEGIN
  IF NEW.share_slug IS NOT NULL AND btrim(NEW.share_slug) <> '' THEN
    RETURN NEW;
  END IF;
  base := regexp_replace(lower(coalesce(NEW.first_name, 'player')), '[^a-z0-9]', '', 'g');
  IF base = '' THEN base := 'player'; END IF;
  candidate := base || '-' || substr(md5(coalesce(NEW.id::text, gen_random_uuid()::text) || clock_timestamp()::text), 1, 5);
  WHILE EXISTS (SELECT 1 FROM public.bingo_players WHERE share_slug = candidate) LOOP
    n := n + 1;
    candidate := base || '-' || substr(md5(random()::text || clock_timestamp()::text), 1, 5 + (n / 5));
    IF n > 25 THEN EXIT; END IF;
  END LOOP;
  NEW.share_slug := candidate;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bingo_players_set_share_slug ON public.bingo_players;
CREATE TRIGGER trg_bingo_players_set_share_slug
BEFORE INSERT ON public.bingo_players
FOR EACH ROW EXECUTE FUNCTION public.bingo_players_set_share_slug();