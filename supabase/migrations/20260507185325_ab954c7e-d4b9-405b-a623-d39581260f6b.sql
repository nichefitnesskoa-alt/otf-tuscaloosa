
DROP TABLE IF EXISTS public.vip_touchpoints CASCADE;
DROP TABLE IF EXISTS public.vip_members CASCADE;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'vip_registrations'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.vip_registrations;
  END IF;
END $$;
