-- 1. vip_members central profile
CREATE TABLE public.vip_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name text NOT NULL,
  last_name text,
  phone text,
  phone_normalized text GENERATED ALWAYS AS (regexp_replace(COALESCE(phone,''), '\D', '', 'g')) STORED,
  email text,
  birthday date,
  is_vip boolean NOT NULL DEFAULT true,
  vip_last_interaction_at timestamptz,
  vip_notes text,
  vip_referral_count integer NOT NULL DEFAULT 0,
  vip_milestones jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_by text NOT NULL DEFAULT 'system',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE UNIQUE INDEX vip_members_phone_uniq
  ON public.vip_members(phone_normalized)
  WHERE phone_normalized <> '' AND deleted_at IS NULL;

CREATE INDEX vip_members_name_idx ON public.vip_members(lower(first_name), lower(last_name)) WHERE deleted_at IS NULL;

ALTER TABLE public.vip_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all read vip_members" ON public.vip_members FOR SELECT USING (true);
CREATE POLICY "Allow all insert vip_members" ON public.vip_members FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all update vip_members" ON public.vip_members FOR UPDATE USING (true);
CREATE POLICY "Allow all delete vip_members" ON public.vip_members FOR DELETE USING (true);

CREATE TRIGGER vip_members_updated_at
  BEFORE UPDATE ON public.vip_members
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. vip_registrations linkage
ALTER TABLE public.vip_registrations
  ADD COLUMN vip_member_id uuid REFERENCES public.vip_members(id) ON DELETE SET NULL;
CREATE INDEX vip_registrations_member_idx ON public.vip_registrations(vip_member_id);

-- 3. Backfill: collapse existing vip_registrations into vip_members
WITH ranked AS (
  SELECT
    id,
    first_name,
    last_name,
    phone,
    email,
    birthday,
    regexp_replace(COALESCE(phone,''), '\D', '', 'g') AS pn,
    lower(COALESCE(first_name,'') || '|' || COALESCE(last_name,'')) AS name_key,
    created_at,
    ROW_NUMBER() OVER (
      PARTITION BY
        CASE WHEN regexp_replace(COALESCE(phone,''), '\D', '', 'g') <> ''
             THEN regexp_replace(COALESCE(phone,''), '\D', '', 'g')
             ELSE lower(COALESCE(first_name,'') || '|' || COALESCE(last_name,''))
        END
      ORDER BY created_at ASC
    ) AS rn
  FROM public.vip_registrations
  WHERE COALESCE(first_name,'') <> ''
)
INSERT INTO public.vip_members (first_name, last_name, phone, email, birthday, created_by, created_at)
SELECT first_name, last_name, phone, email, birthday, 'backfill', created_at
FROM ranked
WHERE rn = 1;

-- Link registrations back to members (by phone first, then by name)
UPDATE public.vip_registrations r
SET vip_member_id = m.id
FROM public.vip_members m
WHERE r.vip_member_id IS NULL
  AND regexp_replace(COALESCE(r.phone,''), '\D', '', 'g') <> ''
  AND regexp_replace(COALESCE(r.phone,''), '\D', '', 'g') = m.phone_normalized;

UPDATE public.vip_registrations r
SET vip_member_id = m.id
FROM public.vip_members m
WHERE r.vip_member_id IS NULL
  AND lower(COALESCE(r.first_name,'')) = lower(COALESCE(m.first_name,''))
  AND lower(COALESCE(r.last_name,'')) = lower(COALESCE(m.last_name,''));

-- 4. vip_touchpoints
CREATE TABLE public.vip_touchpoints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vip_member_id uuid NOT NULL REFERENCES public.vip_members(id) ON DELETE CASCADE,
  staff_name text NOT NULL,
  touchpoint_type text NOT NULL CHECK (touchpoint_type IN ('text','call','in_person','email','class_visit')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX vip_touchpoints_member_idx ON public.vip_touchpoints(vip_member_id, created_at DESC);

ALTER TABLE public.vip_touchpoints ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all read vip_touchpoints" ON public.vip_touchpoints FOR SELECT USING (true);
CREATE POLICY "Allow all insert vip_touchpoints" ON public.vip_touchpoints FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all update vip_touchpoints" ON public.vip_touchpoints FOR UPDATE USING (true);
CREATE POLICY "Allow all delete vip_touchpoints" ON public.vip_touchpoints FOR DELETE USING (true);

-- 5. Trigger: bump vip_last_interaction_at on touchpoint insert
CREATE OR REPLACE FUNCTION public.bump_vip_last_interaction()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.vip_members
  SET vip_last_interaction_at = NEW.created_at
  WHERE id = NEW.vip_member_id
    AND (vip_last_interaction_at IS NULL OR vip_last_interaction_at < NEW.created_at);
  RETURN NEW;
END;
$$;

CREATE TRIGGER vip_touchpoints_bump_interaction
  AFTER INSERT ON public.vip_touchpoints
  FOR EACH ROW EXECUTE FUNCTION public.bump_vip_last_interaction();

-- 6. Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.vip_members;
ALTER PUBLICATION supabase_realtime ADD TABLE public.vip_touchpoints;