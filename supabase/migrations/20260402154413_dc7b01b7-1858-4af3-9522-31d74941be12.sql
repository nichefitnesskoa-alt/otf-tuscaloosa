-- Allow public read access to staff table
CREATE POLICY "Allow public read staff"
ON public.staff
FOR SELECT
TO public
USING (true);

-- Allow public insert for adding staff
CREATE POLICY "Allow public insert staff"
ON public.staff
FOR INSERT
TO public
WITH CHECK (true);

-- Allow public update for editing/deactivating staff
CREATE POLICY "Allow public update staff"
ON public.staff
FOR UPDATE
TO public
USING (true);