-- Drop existing restrictive RLS policies and make tables accessible for the dropdown-based login system

-- shift_recaps
DROP POLICY IF EXISTS "Authenticated staff can read shift_recaps" ON public.shift_recaps;
DROP POLICY IF EXISTS "Authenticated staff can insert shift_recaps" ON public.shift_recaps;
DROP POLICY IF EXISTS "Authenticated staff can update shift_recaps" ON public.shift_recaps;
DROP POLICY IF EXISTS "Authenticated staff can delete shift_recaps" ON public.shift_recaps;

CREATE POLICY "Allow all read shift_recaps" ON public.shift_recaps FOR SELECT USING (true);
CREATE POLICY "Allow all insert shift_recaps" ON public.shift_recaps FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all update shift_recaps" ON public.shift_recaps FOR UPDATE USING (true);
CREATE POLICY "Allow all delete shift_recaps" ON public.shift_recaps FOR DELETE USING (true);

-- intros_booked
DROP POLICY IF EXISTS "Authenticated staff can read intros_booked" ON public.intros_booked;
DROP POLICY IF EXISTS "Authenticated staff can insert intros_booked" ON public.intros_booked;
DROP POLICY IF EXISTS "Authenticated staff can update intros_booked" ON public.intros_booked;
DROP POLICY IF EXISTS "Authenticated staff can delete intros_booked" ON public.intros_booked;

CREATE POLICY "Allow all read intros_booked" ON public.intros_booked FOR SELECT USING (true);
CREATE POLICY "Allow all insert intros_booked" ON public.intros_booked FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all update intros_booked" ON public.intros_booked FOR UPDATE USING (true);
CREATE POLICY "Allow all delete intros_booked" ON public.intros_booked FOR DELETE USING (true);

-- intros_run
DROP POLICY IF EXISTS "Authenticated staff can read intros_run" ON public.intros_run;
DROP POLICY IF EXISTS "Authenticated staff can insert intros_run" ON public.intros_run;
DROP POLICY IF EXISTS "Authenticated staff can update intros_run" ON public.intros_run;
DROP POLICY IF EXISTS "Authenticated staff can delete intros_run" ON public.intros_run;

CREATE POLICY "Allow all read intros_run" ON public.intros_run FOR SELECT USING (true);
CREATE POLICY "Allow all insert intros_run" ON public.intros_run FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all update intros_run" ON public.intros_run FOR UPDATE USING (true);
CREATE POLICY "Allow all delete intros_run" ON public.intros_run FOR DELETE USING (true);

-- sales_outside_intro
DROP POLICY IF EXISTS "Authenticated staff can read sales_outside_intro" ON public.sales_outside_intro;
DROP POLICY IF EXISTS "Authenticated staff can insert sales_outside_intro" ON public.sales_outside_intro;
DROP POLICY IF EXISTS "Authenticated staff can update sales_outside_intro" ON public.sales_outside_intro;
DROP POLICY IF EXISTS "Authenticated staff can delete sales_outside_intro" ON public.sales_outside_intro;

CREATE POLICY "Allow all read sales_outside_intro" ON public.sales_outside_intro FOR SELECT USING (true);
CREATE POLICY "Allow all insert sales_outside_intro" ON public.sales_outside_intro FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all update sales_outside_intro" ON public.sales_outside_intro FOR UPDATE USING (true);
CREATE POLICY "Allow all delete sales_outside_intro" ON public.sales_outside_intro FOR DELETE USING (true);

-- sheets_sync_log
DROP POLICY IF EXISTS "Authenticated staff can read sheets_sync_log" ON public.sheets_sync_log;
DROP POLICY IF EXISTS "Authenticated staff can insert sheets_sync_log" ON public.sheets_sync_log;

CREATE POLICY "Allow all read sheets_sync_log" ON public.sheets_sync_log FOR SELECT USING (true);
CREATE POLICY "Allow all insert sheets_sync_log" ON public.sheets_sync_log FOR INSERT WITH CHECK (true);

-- daily_recaps
DROP POLICY IF EXISTS "Authenticated staff can read daily_recaps" ON public.daily_recaps;
DROP POLICY IF EXISTS "Authenticated staff can insert daily_recaps" ON public.daily_recaps;
DROP POLICY IF EXISTS "Authenticated staff can update daily_recaps" ON public.daily_recaps;
DROP POLICY IF EXISTS "Authenticated staff can delete daily_recaps" ON public.daily_recaps;

CREATE POLICY "Allow all read daily_recaps" ON public.daily_recaps FOR SELECT USING (true);
CREATE POLICY "Allow all insert daily_recaps" ON public.daily_recaps FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all update daily_recaps" ON public.daily_recaps FOR UPDATE USING (true);
CREATE POLICY "Allow all delete daily_recaps" ON public.daily_recaps FOR DELETE USING (true);

-- ig_leads
DROP POLICY IF EXISTS "Authenticated staff can read ig_leads" ON public.ig_leads;
DROP POLICY IF EXISTS "Authenticated staff can insert ig_leads" ON public.ig_leads;
DROP POLICY IF EXISTS "Authenticated staff can update ig_leads" ON public.ig_leads;
DROP POLICY IF EXISTS "Authenticated staff can delete ig_leads" ON public.ig_leads;

CREATE POLICY "Allow all read ig_leads" ON public.ig_leads FOR SELECT USING (true);
CREATE POLICY "Allow all insert ig_leads" ON public.ig_leads FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all update ig_leads" ON public.ig_leads FOR UPDATE USING (true);
CREATE POLICY "Allow all delete ig_leads" ON public.ig_leads FOR DELETE USING (true);