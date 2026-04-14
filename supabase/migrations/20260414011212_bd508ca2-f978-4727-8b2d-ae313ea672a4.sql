ALTER TABLE public.vip_sessions
  ADD COLUMN IF NOT EXISTS actual_attendance integer,
  ADD COLUMN IF NOT EXISTS attendance_logged_by text,
  ADD COLUMN IF NOT EXISTS attendance_logged_at timestamptz;