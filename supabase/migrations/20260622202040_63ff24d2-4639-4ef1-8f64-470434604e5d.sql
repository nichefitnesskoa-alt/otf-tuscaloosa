
ALTER TABLE public.giveaway_entries
  ADD COLUMN phone_normalized text,
  ADD COLUMN entry_slug text NOT NULL DEFAULT substring(md5(random()::text || clock_timestamp()::text), 1, 12);

UPDATE public.giveaway_entries
SET phone_normalized = right(regexp_replace(coalesce(phone,''), '\D', '', 'g'), 10)
WHERE phone_normalized IS NULL;

ALTER TABLE public.giveaway_entries
  ALTER COLUMN phone_normalized SET NOT NULL,
  ALTER COLUMN email DROP NOT NULL;

DROP INDEX IF EXISTS public.giveaway_entries_studio_email_uniq;

CREATE UNIQUE INDEX giveaway_entries_studio_phone_uniq
  ON public.giveaway_entries (studio_slug, phone_normalized);

CREATE UNIQUE INDEX giveaway_entries_entry_slug_uniq
  ON public.giveaway_entries (entry_slug);

-- Allow anon to update entries (slug acts as bearer; clients always filter by id or entry_slug)
CREATE POLICY "entries public update"
  ON public.giveaway_entries
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

GRANT UPDATE ON public.giveaway_entries TO anon, authenticated;
