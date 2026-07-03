
-- 1) Rescue mis-mapped 30d count from bogus 1900 dates
UPDATE public.outreach_list_rows
SET last_30d_count = EXTRACT(DAY FROM latest_workout_date)::int,
    worked_out_30d = (EXTRACT(DAY FROM latest_workout_date)::int > 0),
    latest_workout_date = NULL
WHERE latest_workout_date IS NOT NULL
  AND latest_workout_date < DATE '1970-01-01';

-- 2) Parse real "Latest Workout Date" from metadata (e.g. "Jun 27, 2026")
UPDATE public.outreach_list_rows
SET latest_workout_date = to_date(metadata->>'Latest Workout Date', 'Mon DD, YYYY')
WHERE latest_workout_date IS NULL
  AND metadata ? 'Latest Workout Date'
  AND (metadata->>'Latest Workout Date') ~ '^[A-Za-z]{3} \d{1,2}, \d{4}$';
