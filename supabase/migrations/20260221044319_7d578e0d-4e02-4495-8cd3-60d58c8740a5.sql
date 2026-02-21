
-- Create data_audit_log table for storing audit run history
CREATE TABLE public.data_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  total_checks integer NOT NULL DEFAULT 0,
  pass_count integer NOT NULL DEFAULT 0,
  warn_count integer NOT NULL DEFAULT 0,
  fail_count integer NOT NULL DEFAULT 0,
  results jsonb NOT NULL DEFAULT '[]'::jsonb
);

-- Enable RLS
ALTER TABLE public.data_audit_log ENABLE ROW LEVEL SECURITY;

-- Only authenticated staff can read
CREATE POLICY "Authenticated can read audit log"
  ON public.data_audit_log FOR SELECT
  TO authenticated
  USING (true);

-- Only admins can insert/delete
CREATE POLICY "Admins can insert audit log"
  ON public.data_audit_log FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete audit log"
  ON public.data_audit_log FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Index for recent lookups
CREATE INDEX idx_audit_log_created ON public.data_audit_log (created_at DESC);
