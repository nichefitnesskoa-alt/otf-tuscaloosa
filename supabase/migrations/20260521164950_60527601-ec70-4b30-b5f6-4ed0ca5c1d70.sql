ALTER TABLE public.giveaway_studios
  ADD COLUMN IF NOT EXISTS deck_contact_name text,
  ADD COLUMN IF NOT EXISTS deck_contact_title text,
  ADD COLUMN IF NOT EXISTS deck_contact_phone text,
  ADD COLUMN IF NOT EXISTS deck_contact_email text,
  ADD COLUMN IF NOT EXISTS deck_prize_anchor_value integer DEFAULT 169,
  ADD COLUMN IF NOT EXISTS deck_headline_value text,
  ADD COLUMN IF NOT EXISTS deck_intro_copy text,
  ADD COLUMN IF NOT EXISTS deck_what_we_need_prize text,
  ADD COLUMN IF NOT EXISTS deck_what_we_need_promotion text,
  ADD COLUMN IF NOT EXISTS deck_what_we_need_class text,
  ADD COLUMN IF NOT EXISTS deck_what_we_need_time text;