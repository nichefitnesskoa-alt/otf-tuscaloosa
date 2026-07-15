
ALTER TABLE public.intros_run
  ADD COLUMN IF NOT EXISTS is_winback boolean NOT NULL DEFAULT false;

ALTER TABLE public.sales_outside_intro
  ADD COLUMN IF NOT EXISTS is_winback boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_intros_run_is_winback ON public.intros_run (is_winback) WHERE is_winback = true;
