ALTER TABLE public.giveaway_partners ADD COLUMN IF NOT EXISTS prize_description text;

ALTER TABLE public.giveaway_studios ADD COLUMN IF NOT EXISTS winner_structure text NOT NULL DEFAULT 'single';

ALTER TABLE public.giveaway_studios DROP CONSTRAINT IF EXISTS giveaway_studios_winner_structure_chk;
ALTER TABLE public.giveaway_studios ADD CONSTRAINT giveaway_studios_winner_structure_chk
  CHECK (winner_structure IN ('single','per_prize_with_removal','per_prize_allow_repeat'));