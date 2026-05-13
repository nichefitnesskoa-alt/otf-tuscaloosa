ALTER TABLE public.table_responses DROP CONSTRAINT IF EXISTS table_responses_mode_check;
UPDATE public.table_responses SET mode = 'add' WHERE mode = 'build';
UPDATE public.table_responses SET mode = 'own_it' WHERE mode = 'offer';
ALTER TABLE public.table_responses ADD CONSTRAINT table_responses_mode_check CHECK (mode IN ('add','flag','own_it'));