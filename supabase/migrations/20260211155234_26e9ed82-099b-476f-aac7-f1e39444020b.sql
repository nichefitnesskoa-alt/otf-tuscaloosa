
-- Drop the existing restrictive DELETE policy
DROP POLICY IF EXISTS "Allow delete completed questionnaires" ON public.intro_questionnaires;

-- Create a new permissive DELETE policy allowing any questionnaire to be deleted
CREATE POLICY "Allow delete questionnaires"
ON public.intro_questionnaires
FOR DELETE
USING (true);
