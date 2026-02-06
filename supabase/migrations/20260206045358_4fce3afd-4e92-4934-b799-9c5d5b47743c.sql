-- 1. Add user_id column to staff table to link with auth.users
ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS email TEXT UNIQUE;
CREATE UNIQUE INDEX IF NOT EXISTS idx_staff_user_id ON public.staff(user_id) WHERE user_id IS NOT NULL;

-- 2. Create app_role enum type
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin', 'coach', 'sa');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 3. Create user_roles table for secure role management
CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

-- Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 4. Create security definer function to check roles (prevents infinite recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- 5. Create function to check if user is authenticated staff
CREATE OR REPLACE FUNCTION public.is_authenticated_staff(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.staff
    WHERE user_id = _user_id
  )
$$;

-- 6. Create function to get staff name from user_id
CREATE OR REPLACE FUNCTION public.get_staff_name(_user_id UUID)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT name FROM public.staff WHERE user_id = _user_id LIMIT 1
$$;

-- 7. Drop all existing public policies
DROP POLICY IF EXISTS "Allow public read access" ON public.staff;
DROP POLICY IF EXISTS "Allow public insert access" ON public.staff;
DROP POLICY IF EXISTS "Allow public update access" ON public.staff;
DROP POLICY IF EXISTS "Allow public delete access" ON public.staff;

DROP POLICY IF EXISTS "Allow public read access" ON public.ig_leads;
DROP POLICY IF EXISTS "Allow public insert access" ON public.ig_leads;
DROP POLICY IF EXISTS "Allow public update access" ON public.ig_leads;
DROP POLICY IF EXISTS "Allow public delete access" ON public.ig_leads;

DROP POLICY IF EXISTS "Allow public read access" ON public.intros_booked;
DROP POLICY IF EXISTS "Allow public insert access" ON public.intros_booked;
DROP POLICY IF EXISTS "Allow public update access" ON public.intros_booked;
DROP POLICY IF EXISTS "Allow public delete access" ON public.intros_booked;

DROP POLICY IF EXISTS "Allow public read access" ON public.intros_run;
DROP POLICY IF EXISTS "Allow public insert access" ON public.intros_run;
DROP POLICY IF EXISTS "Allow public update access" ON public.intros_run;
DROP POLICY IF EXISTS "Allow public delete access" ON public.intros_run;

DROP POLICY IF EXISTS "Allow public read access" ON public.sales_outside_intro;
DROP POLICY IF EXISTS "Allow public insert access" ON public.sales_outside_intro;
DROP POLICY IF EXISTS "Allow public update access" ON public.sales_outside_intro;
DROP POLICY IF EXISTS "Allow public delete access" ON public.sales_outside_intro;

DROP POLICY IF EXISTS "Allow public read access" ON public.shift_recaps;
DROP POLICY IF EXISTS "Allow public insert access" ON public.shift_recaps;
DROP POLICY IF EXISTS "Allow public update access" ON public.shift_recaps;
DROP POLICY IF EXISTS "Allow public delete access" ON public.shift_recaps;

DROP POLICY IF EXISTS "Allow public read access" ON public.daily_recaps;
DROP POLICY IF EXISTS "Allow public insert access" ON public.daily_recaps;
DROP POLICY IF EXISTS "Allow public update access" ON public.daily_recaps;
DROP POLICY IF EXISTS "Allow public delete access" ON public.daily_recaps;

DROP POLICY IF EXISTS "Allow public read access" ON public.sheets_sync_log;
DROP POLICY IF EXISTS "Allow public insert access" ON public.sheets_sync_log;

-- 8. Create new authenticated-only policies for user_roles
CREATE POLICY "Users can view own roles" ON public.user_roles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins can manage all roles" ON public.user_roles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 9. Create new authenticated-only policies for staff
CREATE POLICY "Authenticated users can view staff" ON public.staff
  FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can manage staff" ON public.staff
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 10. Create authenticated-only policies for ig_leads
CREATE POLICY "Authenticated staff can read ig_leads" ON public.ig_leads
  FOR SELECT TO authenticated
  USING (public.is_authenticated_staff(auth.uid()));

CREATE POLICY "Authenticated staff can insert ig_leads" ON public.ig_leads
  FOR INSERT TO authenticated
  WITH CHECK (public.is_authenticated_staff(auth.uid()));

CREATE POLICY "Authenticated staff can update ig_leads" ON public.ig_leads
  FOR UPDATE TO authenticated
  USING (public.is_authenticated_staff(auth.uid()));

CREATE POLICY "Authenticated staff can delete ig_leads" ON public.ig_leads
  FOR DELETE TO authenticated
  USING (public.is_authenticated_staff(auth.uid()));

-- 11. Create authenticated-only policies for intros_booked
CREATE POLICY "Authenticated staff can read intros_booked" ON public.intros_booked
  FOR SELECT TO authenticated
  USING (public.is_authenticated_staff(auth.uid()));

CREATE POLICY "Authenticated staff can insert intros_booked" ON public.intros_booked
  FOR INSERT TO authenticated
  WITH CHECK (public.is_authenticated_staff(auth.uid()));

CREATE POLICY "Authenticated staff can update intros_booked" ON public.intros_booked
  FOR UPDATE TO authenticated
  USING (public.is_authenticated_staff(auth.uid()));

CREATE POLICY "Authenticated staff can delete intros_booked" ON public.intros_booked
  FOR DELETE TO authenticated
  USING (public.is_authenticated_staff(auth.uid()));

-- 12. Create authenticated-only policies for intros_run
CREATE POLICY "Authenticated staff can read intros_run" ON public.intros_run
  FOR SELECT TO authenticated
  USING (public.is_authenticated_staff(auth.uid()));

CREATE POLICY "Authenticated staff can insert intros_run" ON public.intros_run
  FOR INSERT TO authenticated
  WITH CHECK (public.is_authenticated_staff(auth.uid()));

CREATE POLICY "Authenticated staff can update intros_run" ON public.intros_run
  FOR UPDATE TO authenticated
  USING (public.is_authenticated_staff(auth.uid()));

CREATE POLICY "Authenticated staff can delete intros_run" ON public.intros_run
  FOR DELETE TO authenticated
  USING (public.is_authenticated_staff(auth.uid()));

-- 13. Create authenticated-only policies for sales_outside_intro
CREATE POLICY "Authenticated staff can read sales_outside_intro" ON public.sales_outside_intro
  FOR SELECT TO authenticated
  USING (public.is_authenticated_staff(auth.uid()));

CREATE POLICY "Authenticated staff can insert sales_outside_intro" ON public.sales_outside_intro
  FOR INSERT TO authenticated
  WITH CHECK (public.is_authenticated_staff(auth.uid()));

CREATE POLICY "Authenticated staff can update sales_outside_intro" ON public.sales_outside_intro
  FOR UPDATE TO authenticated
  USING (public.is_authenticated_staff(auth.uid()));

CREATE POLICY "Authenticated staff can delete sales_outside_intro" ON public.sales_outside_intro
  FOR DELETE TO authenticated
  USING (public.is_authenticated_staff(auth.uid()));

-- 14. Create authenticated-only policies for shift_recaps
CREATE POLICY "Authenticated staff can read shift_recaps" ON public.shift_recaps
  FOR SELECT TO authenticated
  USING (public.is_authenticated_staff(auth.uid()));

CREATE POLICY "Authenticated staff can insert shift_recaps" ON public.shift_recaps
  FOR INSERT TO authenticated
  WITH CHECK (public.is_authenticated_staff(auth.uid()));

CREATE POLICY "Authenticated staff can update shift_recaps" ON public.shift_recaps
  FOR UPDATE TO authenticated
  USING (public.is_authenticated_staff(auth.uid()));

CREATE POLICY "Authenticated staff can delete shift_recaps" ON public.shift_recaps
  FOR DELETE TO authenticated
  USING (public.is_authenticated_staff(auth.uid()));

-- 15. Create authenticated-only policies for daily_recaps
CREATE POLICY "Authenticated staff can read daily_recaps" ON public.daily_recaps
  FOR SELECT TO authenticated
  USING (public.is_authenticated_staff(auth.uid()));

CREATE POLICY "Authenticated staff can insert daily_recaps" ON public.daily_recaps
  FOR INSERT TO authenticated
  WITH CHECK (public.is_authenticated_staff(auth.uid()));

CREATE POLICY "Authenticated staff can update daily_recaps" ON public.daily_recaps
  FOR UPDATE TO authenticated
  USING (public.is_authenticated_staff(auth.uid()));

CREATE POLICY "Authenticated staff can delete daily_recaps" ON public.daily_recaps
  FOR DELETE TO authenticated
  USING (public.is_authenticated_staff(auth.uid()));

-- 16. Create authenticated-only policies for sheets_sync_log
CREATE POLICY "Authenticated staff can read sheets_sync_log" ON public.sheets_sync_log
  FOR SELECT TO authenticated
  USING (public.is_authenticated_staff(auth.uid()));

CREATE POLICY "Authenticated staff can insert sheets_sync_log" ON public.sheets_sync_log
  FOR INSERT TO authenticated
  WITH CHECK (public.is_authenticated_staff(auth.uid()));