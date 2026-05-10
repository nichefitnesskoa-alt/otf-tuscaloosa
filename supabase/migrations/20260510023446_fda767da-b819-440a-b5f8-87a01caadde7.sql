ALTER TABLE public.staff DROP CONSTRAINT IF EXISTS staff_role_check;
ALTER TABLE public.staff ADD CONSTRAINT staff_role_check
  CHECK (role = ANY (ARRAY['SA'::text, 'Coach'::text, 'Both'::text, 'Admin'::text]));