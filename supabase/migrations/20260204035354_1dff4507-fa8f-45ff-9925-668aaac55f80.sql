-- Add DELETE policy for shift_recaps table
CREATE POLICY "Allow public delete access" 
ON public.shift_recaps 
FOR DELETE 
USING (true);