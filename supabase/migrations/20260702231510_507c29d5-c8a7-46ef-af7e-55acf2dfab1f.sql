
-- 1. Short codes on events
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS short_code text UNIQUE;

CREATE OR REPLACE FUNCTION public.gen_event_short_code()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  candidate text;
  tries int := 0;
BEGIN
  IF NEW.short_code IS NOT NULL AND btrim(NEW.short_code) <> '' THEN RETURN NEW; END IF;
  LOOP
    candidate := lower(substr(md5(gen_random_uuid()::text || clock_timestamp()::text), 1, 4));
    IF NOT EXISTS (SELECT 1 FROM public.events WHERE short_code = candidate) THEN
      NEW.short_code := candidate;
      RETURN NEW;
    END IF;
    tries := tries + 1;
    IF tries > 25 THEN
      NEW.short_code := lower(substr(md5(gen_random_uuid()::text), 1, 6));
      RETURN NEW;
    END IF;
  END LOOP;
END;
$$;

DROP TRIGGER IF EXISTS trg_events_short_code ON public.events;
CREATE TRIGGER trg_events_short_code BEFORE INSERT ON public.events
FOR EACH ROW EXECUTE FUNCTION public.gen_event_short_code();

-- Backfill existing events
UPDATE public.events SET short_code = lower(substr(md5(id::text), 1, 4))
WHERE short_code IS NULL;

-- 2. Friend codes on intros_booked
ALTER TABLE public.intros_booked ADD COLUMN IF NOT EXISTS friend_code text UNIQUE;

CREATE OR REPLACE FUNCTION public.gen_intro_friend_code(_id uuid)
RETURNS text LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  candidate text; tries int := 0; existing text;
BEGIN
  SELECT friend_code INTO existing FROM public.intros_booked WHERE id = _id;
  IF existing IS NOT NULL THEN RETURN existing; END IF;
  LOOP
    candidate := lower(substr(md5(gen_random_uuid()::text || clock_timestamp()::text), 1, 6));
    IF NOT EXISTS (SELECT 1 FROM public.intros_booked WHERE friend_code = candidate) THEN
      UPDATE public.intros_booked SET friend_code = candidate WHERE id = _id;
      RETURN candidate;
    END IF;
    tries := tries + 1;
    IF tries > 25 THEN
      candidate := lower(substr(md5(_id::text || clock_timestamp()::text), 1, 8));
      UPDATE public.intros_booked SET friend_code = candidate WHERE id = _id;
      RETURN candidate;
    END IF;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.gen_intro_friend_code(uuid) TO anon, authenticated, service_role;

-- 3. intro_link_codes table
CREATE TABLE IF NOT EXISTS public.intro_link_codes (
  code text PRIMARY KEY,
  sa_name text NOT NULL,
  source text NOT NULL,
  event_id uuid REFERENCES public.events(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (sa_name, source, event_id)
);

CREATE INDEX IF NOT EXISTS idx_intro_link_codes_sa ON public.intro_link_codes(sa_name);

GRANT SELECT ON public.intro_link_codes TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.intro_link_codes TO authenticated;
GRANT ALL ON public.intro_link_codes TO service_role;

ALTER TABLE public.intro_link_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read intro link codes"
  ON public.intro_link_codes FOR SELECT
  USING (true);

CREATE POLICY "Authenticated can create intro link codes"
  ON public.intro_link_codes FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated can update intro link codes"
  ON public.intro_link_codes FOR UPDATE
  TO authenticated
  USING (true) WITH CHECK (true);
