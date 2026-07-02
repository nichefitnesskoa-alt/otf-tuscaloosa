
-- ============================================================
-- Intro Scheduler Link — schema
-- ============================================================

-- 1) Weekly bookable-slot template for the PUBLIC intro scheduler
CREATE TABLE public.intro_bookable_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  day_of_week smallint NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  slot_time time NOT NULL,
  class_label text,               -- e.g. '2G', 'S/T50 Upper' — informational
  is_bookable boolean NOT NULL DEFAULT true,  -- false = shown internally but blocked publicly (S/T50)
  is_active boolean NOT NULL DEFAULT true,     -- false = removed from weekly template
  updated_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (day_of_week, slot_time)
);
GRANT SELECT ON public.intro_bookable_slots TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.intro_bookable_slots TO authenticated;
GRANT ALL ON public.intro_bookable_slots TO service_role;
ALTER TABLE public.intro_bookable_slots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read intro_bookable_slots" ON public.intro_bookable_slots FOR SELECT USING (true);
CREATE POLICY "staff manage intro_bookable_slots" ON public.intro_bookable_slots FOR ALL USING (true) WITH CHECK (true);
CREATE TRIGGER trg_intro_bookable_slots_updated_at
  BEFORE UPDATE ON public.intro_bookable_slots
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) Per-date overrides (cancel a specific class, or add an extra class not in the weekly template)
CREATE TABLE public.intro_bookable_slot_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_date date NOT NULL,
  slot_time time NOT NULL,
  action text NOT NULL CHECK (action IN ('cancel', 'add')),
  note text,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (class_date, slot_time, action)
);
GRANT SELECT ON public.intro_bookable_slot_overrides TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.intro_bookable_slot_overrides TO authenticated;
GRANT ALL ON public.intro_bookable_slot_overrides TO service_role;
ALTER TABLE public.intro_bookable_slot_overrides ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read intro_bookable_slot_overrides" ON public.intro_bookable_slot_overrides FOR SELECT USING (true);
CREATE POLICY "staff manage intro_bookable_slot_overrides" ON public.intro_bookable_slot_overrides FOR ALL USING (true) WITH CHECK (true);

-- 3) Per-user MyDay banner acknowledgement for new link bookings
CREATE TABLE public.intro_booking_seen (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES public.intros_booked(id) ON DELETE CASCADE,
  seen_by text NOT NULL,
  seen_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (booking_id, seen_by)
);
GRANT SELECT, INSERT, DELETE ON public.intro_booking_seen TO authenticated;
GRANT ALL ON public.intro_booking_seen TO service_role;
ALTER TABLE public.intro_booking_seen ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff manage intro_booking_seen" ON public.intro_booking_seen FOR ALL USING (true) WITH CHECK (true);

-- 4) Flag on intros_booked so MyDay realtime + banner can identify link bookings
--    reliably (not by brittle lead_source string matching, since event-sourced
--    link bookings have lead_source='Event').
ALTER TABLE public.intros_booked
  ADD COLUMN IF NOT EXISTS via_scheduler_link boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS scheduler_link_sa text;

-- 5) Seed the weekly template from the current authoritative calendar
--    (per user's uploaded schedule image, with S/T50 marked non-bookable).
--    Mon
INSERT INTO public.intro_bookable_slots (day_of_week, slot_time, class_label, is_bookable) VALUES
  (1, '05:00', '2G', true),
  (1, '06:15', '2G', true),
  (1, '07:30', 'S/T50 Upper', false),
  (1, '08:45', '2G', true),
  (1, '11:30', '2G', true),
  (1, '16:15', '2G', true),
  (1, '17:30', '2G', true),
--    Tue (no more 9:30)
  (2, '05:00', '2G', true),
  (2, '06:15', '2G', true),
  (2, '07:30', '2G', true),
  (2, '08:45', '2G', true),
  (2, '11:30', 'S/T50 Lower', false),
  (2, '16:15', '2G', true),
  (2, '17:30', '2G', true),
--    Wed
  (3, '05:00', '2G', true),
  (3, '06:15', '2G', true),
  (3, '07:30', 'S/T50 Total', false),
  (3, '08:45', '2G', true),
  (3, '11:30', '2G', true),
  (3, '16:15', '2G', true),
  (3, '17:30', '2G', true),
--    Thu (no more 9:30)
  (4, '05:00', '2G', true),
  (4, '06:15', '2G', true),
  (4, '07:30', '2G', true),
  (4, '08:45', '2G', true),
  (4, '11:30', 'S/T50 Upper', false),
  (4, '16:15', '2G', true),
  (4, '17:30', '2G', true),
--    Fri
  (5, '05:00', '2G', true),
  (5, '06:15', '2G', true),
  (5, '07:30', 'S/T50 Lower', false),
  (5, '08:45', '2G', true),
  (5, '11:30', '2G', true),
  (5, '16:15', '2G', true),
--    Sat
  (6, '08:00', '2G', true),
  (6, '09:15', '2G', true),
  (6, '10:30', '2G', true),
--    Sun
  (0, '10:00', '2G', true),
  (0, '11:10', 'S/T50', false)
ON CONFLICT (day_of_week, slot_time) DO NOTHING;

-- 6) Enable realtime on intro_booking_seen and intro_bookable_* so MyDay banner + admin editor update live
ALTER PUBLICATION supabase_realtime ADD TABLE public.intro_booking_seen;
ALTER PUBLICATION supabase_realtime ADD TABLE public.intro_bookable_slots;
ALTER PUBLICATION supabase_realtime ADD TABLE public.intro_bookable_slot_overrides;
