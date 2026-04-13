
-- Add new columns
ALTER TABLE public.vip_registrations 
  ADD COLUMN IF NOT EXISTS vip_session_id uuid REFERENCES public.vip_sessions(id),
  ADD COLUMN IF NOT EXISTS fitness_level integer,
  ADD COLUMN IF NOT EXISTS injuries text,
  ADD COLUMN IF NOT EXISTS is_group_contact boolean NOT NULL DEFAULT false;

-- Make first_name, last_name, phone nullable for flexibility
ALTER TABLE public.vip_registrations 
  ALTER COLUMN first_name DROP NOT NULL,
  ALTER COLUMN last_name DROP NOT NULL,
  ALTER COLUMN phone DROP NOT NULL;
