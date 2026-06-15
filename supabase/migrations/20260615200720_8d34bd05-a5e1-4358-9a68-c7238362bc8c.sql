
CREATE TABLE public.bingo_players (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name text NOT NULL,
  last_name text NOT NULL,
  phone text NOT NULL,
  phone_normalized text NOT NULL UNIQUE,
  email text NOT NULL,
  marked_squares text[] NOT NULL DEFAULT '{}',
  blackout_completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.bingo_players TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bingo_players TO authenticated;
GRANT ALL ON public.bingo_players TO service_role;

ALTER TABLE public.bingo_players ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can create a bingo player"
  ON public.bingo_players FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Anyone can read bingo players"
  ON public.bingo_players FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Anyone can update bingo players"
  ON public.bingo_players FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE TRIGGER bingo_players_updated_at
  BEFORE UPDATE ON public.bingo_players
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER PUBLICATION supabase_realtime ADD TABLE public.bingo_players;
ALTER TABLE public.bingo_players REPLICA IDENTITY FULL;
