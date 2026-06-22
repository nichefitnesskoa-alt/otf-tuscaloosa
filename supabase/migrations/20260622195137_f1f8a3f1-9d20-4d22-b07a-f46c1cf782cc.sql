ALTER TABLE public.giveaway_partners ADD COLUMN IF NOT EXISTS prize_count integer NOT NULL DEFAULT 1;
ALTER TABLE public.giveaway_partners ADD CONSTRAINT giveaway_partners_prize_count_chk CHECK (prize_count >= 1 AND prize_count <= 10);

ALTER TABLE public.giveaway_studios ADD COLUMN IF NOT EXISTS countdown_mode text NOT NULL DEFAULT 'fixed_days';
ALTER TABLE public.giveaway_studios ADD CONSTRAINT giveaway_studios_countdown_mode_chk CHECK (countdown_mode IN ('fixed_days','end_of_month'));

ALTER TABLE public.giveaway_entries ADD COLUMN IF NOT EXISTS instagram_handle text;