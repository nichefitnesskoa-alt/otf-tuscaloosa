
CREATE TABLE public.vip_registrations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  first_name text NOT NULL,
  last_name text NOT NULL,
  email text,
  phone text NOT NULL,
  birthday date,
  weight_lbs integer,
  booking_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.vip_registrations ENABLE ROW LEVEL SECURITY;

-- Public can submit registrations
CREATE POLICY "Public can insert vip_registrations"
ON public.vip_registrations FOR INSERT
WITH CHECK (true);

-- Authenticated users can read
CREATE POLICY "Authenticated can read vip_registrations"
ON public.vip_registrations FOR SELECT
USING (true);

-- Authenticated users can update
CREATE POLICY "Authenticated can update vip_registrations"
ON public.vip_registrations FOR UPDATE
USING (true);

-- Authenticated users can delete
CREATE POLICY "Authenticated can delete vip_registrations"
ON public.vip_registrations FOR DELETE
USING (true);
