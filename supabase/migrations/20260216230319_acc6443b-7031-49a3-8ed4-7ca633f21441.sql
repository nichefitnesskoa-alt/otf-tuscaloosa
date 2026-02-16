
-- Success Stories table
CREATE TABLE public.success_stories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE,
  member_first_name text NOT NULL DEFAULT '',
  member_last_name text NOT NULL DEFAULT '',
  studio_location text DEFAULT 'Tuscaloosa',
  membership_duration text,
  motivation text,
  overall_experience text,
  specific_changes text,
  proud_moment text,
  fitness_health_improvement text,
  favorite_aspect text,
  other_comments text,
  social_media_permission boolean DEFAULT false,
  photo_url text,
  featured boolean DEFAULT false,
  status text NOT NULL DEFAULT 'not_sent',
  submitted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.success_stories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read success_stories" ON public.success_stories FOR SELECT USING (true);
CREATE POLICY "Anyone can insert success_stories" ON public.success_stories FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update success_stories" ON public.success_stories FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete success_stories" ON public.success_stories FOR DELETE USING (true);

CREATE TRIGGER update_success_stories_updated_at
  BEFORE UPDATE ON public.success_stories
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Storage bucket for photos
INSERT INTO storage.buckets (id, name, public) VALUES ('success-story-photos', 'success-story-photos', true);

CREATE POLICY "Anyone can upload success story photos"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'success-story-photos');

CREATE POLICY "Anyone can view success story photos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'success-story-photos');
