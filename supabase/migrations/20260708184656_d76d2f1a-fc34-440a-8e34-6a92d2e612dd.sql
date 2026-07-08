ALTER TABLE public.intros_run ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

DROP TRIGGER IF EXISTS trg_intros_run_set_updated_at ON public.intros_run;
CREATE TRIGGER trg_intros_run_set_updated_at
BEFORE UPDATE ON public.intros_run
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();