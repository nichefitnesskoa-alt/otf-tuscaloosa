CREATE POLICY "Allow all delete fv_scorecards"
ON public.fv_scorecards
FOR DELETE
USING (true);

CREATE POLICY "Allow all delete fv_comments"
ON public.fv_scorecard_comments
FOR DELETE
USING (true);