
-- RingCentral webhook: dedup log + subscription health singleton.
-- Both tables are admin-only. Edge function writes with service role.

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 1. Dedup + unmatched reporting
CREATE TABLE public.rc_message_log (
  message_id text PRIMARY KEY,
  direction text NOT NULL CHECK (direction IN ('Inbound', 'Outbound')),
  counterparty_e164 text,
  matched boolean NOT NULL DEFAULT false,
  lead_id uuid,
  booking_id uuid,
  message_ts timestamptz,
  processed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX rc_message_log_processed_at_idx ON public.rc_message_log (processed_at DESC);
CREATE INDEX rc_message_log_matched_idx ON public.rc_message_log (matched, processed_at DESC);

GRANT SELECT ON public.rc_message_log TO authenticated;
GRANT ALL ON public.rc_message_log TO service_role;

ALTER TABLE public.rc_message_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rc_message_log readable by authenticated"
  ON public.rc_message_log FOR SELECT TO authenticated USING (true);

-- 2. Subscription health (singleton — id fixed)
CREATE TABLE public.rc_subscription (
  id text PRIMARY KEY DEFAULT 'primary',
  rc_subscription_id text,
  expires_at timestamptz,
  last_renewed_at timestamptz,
  last_recreated_at timestamptz,
  status text,
  last_error text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.rc_subscription TO authenticated;
GRANT ALL ON public.rc_subscription TO service_role;

ALTER TABLE public.rc_subscription ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rc_subscription readable by authenticated"
  ON public.rc_subscription FOR SELECT TO authenticated USING (true);

INSERT INTO public.rc_subscription (id, status) VALUES ('primary', 'not_created')
ON CONFLICT (id) DO NOTHING;
