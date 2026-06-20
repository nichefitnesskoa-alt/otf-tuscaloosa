ALTER TABLE public.fv_scorecards
ADD COLUMN IF NOT EXISTS replicated_from_scorecard_id uuid NULL
REFERENCES public.fv_scorecards(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS fv_scorecards_replicated_from_idx
ON public.fv_scorecards (replicated_from_scorecard_id)
WHERE replicated_from_scorecard_id IS NOT NULL;