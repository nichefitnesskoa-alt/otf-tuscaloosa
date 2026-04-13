CREATE TABLE public.vip_slot_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  day_of_week integer NOT NULL,
  slot_time time NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.vip_slot_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all read vip_slot_templates" ON public.vip_slot_templates FOR SELECT USING (true);
CREATE POLICY "Allow all insert vip_slot_templates" ON public.vip_slot_templates FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all update vip_slot_templates" ON public.vip_slot_templates FOR UPDATE USING (true);
CREATE POLICY "Allow all delete vip_slot_templates" ON public.vip_slot_templates FOR DELETE USING (true);