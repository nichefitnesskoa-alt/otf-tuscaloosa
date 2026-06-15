
ALTER TABLE public.bingo_players
  ADD COLUMN IF NOT EXISTS bingo_count int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS completed_lines text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS first_bingo_at timestamptz,
  ADD COLUMN IF NOT EXISTS late_cancel_used boolean NOT NULL DEFAULT false;
