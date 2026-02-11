
-- Drop the existing admin-only delete policy
DROP POLICY IF EXISTS "Admins can delete questionnaires" ON public.intro_questionnaires;

-- Allow deleting completed questionnaires (any authenticated or anon user, matching existing permissive pattern)
CREATE POLICY "Allow delete completed questionnaires"
ON public.intro_questionnaires
FOR DELETE
USING (status = 'completed');
