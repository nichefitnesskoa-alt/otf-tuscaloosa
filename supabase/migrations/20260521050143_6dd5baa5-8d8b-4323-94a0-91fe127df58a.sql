
-- Studios
CREATE TABLE public.giveaway_studios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_slug text UNIQUE NOT NULL,
  studio_name text NOT NULL,
  partner_name text,
  partner_instructions text,
  countdown_duration_days integer NOT NULL DEFAULT 7 CHECK (countdown_duration_days IN (7,10,14)),
  goes_live_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Entries
CREATE TABLE public.giveaway_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_slug text NOT NULL REFERENCES public.giveaway_studios(studio_slug),
  first_name text NOT NULL,
  last_name text NOT NULL,
  email text NOT NULL,
  phone text NOT NULL,
  base_entries integer NOT NULL DEFAULT 1,
  bonus_entries integer NOT NULL DEFAULT 0,
  total_entries integer GENERATED ALWAYS AS (base_entries + bonus_entries) STORED,
  action_instagram_follow boolean NOT NULL DEFAULT false,
  action_post_engagement boolean NOT NULL DEFAULT false,
  action_post_engagement_screenshot_url text,
  action_story_share boolean NOT NULL DEFAULT false,
  action_story_share_screenshot_url text,
  action_free_class boolean NOT NULL DEFAULT false,
  action_free_class_screenshot_url text,
  action_partner_visit boolean NOT NULL DEFAULT false,
  action_partner_visit_photo_url text,
  submitted_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX giveaway_entries_studio_email_uniq
  ON public.giveaway_entries (studio_slug, lower(email));

CREATE INDEX giveaway_entries_studio_idx ON public.giveaway_entries (studio_slug);

-- Uploads
CREATE TABLE public.giveaway_uploads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id uuid REFERENCES public.giveaway_entries(id) ON DELETE CASCADE,
  studio_slug text,
  action_type text NOT NULL,
  file_url text NOT NULL,
  uploaded_at timestamptz NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.giveaway_studios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.giveaway_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.giveaway_uploads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "studios public read" ON public.giveaway_studios FOR SELECT USING (true);
CREATE POLICY "studios public update" ON public.giveaway_studios FOR UPDATE USING (true) WITH CHECK (true);

CREATE POLICY "entries public insert" ON public.giveaway_entries FOR INSERT WITH CHECK (true);
CREATE POLICY "entries public read" ON public.giveaway_entries FOR SELECT USING (true);

CREATE POLICY "uploads public insert" ON public.giveaway_uploads FOR INSERT WITH CHECK (true);
CREATE POLICY "uploads public read" ON public.giveaway_uploads FOR SELECT USING (true);

-- updated_at trigger
CREATE TRIGGER giveaway_studios_updated_at
BEFORE UPDATE ON public.giveaway_studios
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed
INSERT INTO public.giveaway_studios (studio_slug, studio_name) VALUES
  ('tuscaloosa', 'OTF Tuscaloosa'),
  ('auburn',     'OTF Auburn'),
  ('montgomery', 'OTF Montgomery'),
  ('vestavia',   'OTF Vestavia');

-- Storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('giveaway-uploads', 'giveaway-uploads', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "giveaway-uploads public read"
ON storage.objects FOR SELECT USING (bucket_id = 'giveaway-uploads');

CREATE POLICY "giveaway-uploads public insert"
ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'giveaway-uploads');
