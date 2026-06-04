ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS sourced_by_sa text NULL;
CREATE INDEX IF NOT EXISTS leads_sourced_by_sa_idx ON public.leads (sourced_by_sa) WHERE sourced_by_sa IS NOT NULL;
COMMENT ON COLUMN public.leads.sourced_by_sa IS 'Name of SA who personally sourced this lead. NULL means inbound / not SA-sourced. Used by useSaLeads + WigSaLeaderboard Leads column.';