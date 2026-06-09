
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS text_archived_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS text_archived_reason text NULL;

CREATE INDEX IF NOT EXISTS leads_to_text_idx
  ON public.leads (sourced_by_sa, created_at)
  WHERE booked_intro_id IS NULL AND text_archived_at IS NULL AND sourced_by_sa IS NOT NULL;

INSERT INTO public.script_categories (name, slug, sort_order, created_by)
VALUES ('Self-Sourced Leads', 'self_sourced', 2, 'system')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.script_templates (name, category, channel, body, is_active, sequence_order)
SELECT
  'First reach-out',
  'self_sourced',
  'sms',
  'hey {first-name}! it''s {sa-first-name} from orangetheory tuscaloosa 🍊 so glad we connected. wanted to lock in your first class — i can get you in totally free, 1-on-1 with a coach. what day this week works best?',
  true,
  1
WHERE NOT EXISTS (
  SELECT 1 FROM public.script_templates WHERE category = 'self_sourced' AND name = 'First reach-out'
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'leads'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.leads;
  END IF;
END $$;

ALTER TABLE public.leads REPLICA IDENTITY FULL;
