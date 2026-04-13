ALTER TABLE public.vip_sessions
ADD COLUMN session_type text NOT NULL DEFAULT 'exclusive';

COMMENT ON COLUMN public.vip_sessions.session_type IS 'exclusive = private group only, open = community class open to OTF members';