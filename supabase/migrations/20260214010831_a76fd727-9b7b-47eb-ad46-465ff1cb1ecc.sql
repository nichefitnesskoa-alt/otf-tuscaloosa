-- Enable realtime for tables not already in publication
DO $$
BEGIN
  -- Check and add each table individually
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'intros_booked'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.intros_booked;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'intros_run'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.intros_run;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'follow_up_queue'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.follow_up_queue;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'script_actions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.script_actions;
  END IF;
END $$;
