
-- 1. New partners table
CREATE TABLE public.giveaway_partners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_slug text NOT NULL REFERENCES public.giveaway_studios(studio_slug) ON DELETE CASCADE,
  partner_name text NOT NULL,
  partner_ig_handle text,
  receipt_instructions text,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_giveaway_partners_studio ON public.giveaway_partners(studio_slug, display_order);
ALTER TABLE public.giveaway_partners ENABLE ROW LEVEL SECURITY;
CREATE POLICY "partners public read" ON public.giveaway_partners FOR SELECT USING (true);
CREATE POLICY "partners public insert" ON public.giveaway_partners FOR INSERT WITH CHECK (true);
CREATE POLICY "partners public update" ON public.giveaway_partners FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "partners public delete" ON public.giveaway_partners FOR DELETE USING (true);

-- 2. Add partner_actions jsonb to entries
ALTER TABLE public.giveaway_entries
  ADD COLUMN partner_actions jsonb NOT NULL DEFAULT '[]'::jsonb;

-- 3. Change base_entries default to 0
ALTER TABLE public.giveaway_entries ALTER COLUMN base_entries SET DEFAULT 0;

-- 4. Drop old single-partner fields from studios
ALTER TABLE public.giveaway_studios DROP COLUMN IF EXISTS partner_name;
ALTER TABLE public.giveaway_studios DROP COLUMN IF EXISTS partner_instructions;

-- 5. Vestavia rename
UPDATE public.giveaway_studios SET studio_name = 'OTF Vestavia Hills' WHERE studio_slug = 'vestavia';
