ALTER TABLE public.table_owners DROP CONSTRAINT IF EXISTS table_owners_staff_id_key;
ALTER TABLE public.table_owners ADD CONSTRAINT table_owners_staff_id_lane_name_key UNIQUE (staff_id, lane_name);