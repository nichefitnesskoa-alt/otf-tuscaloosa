
-- Backfill intros_booked.intro_time: convert AM/PM strings to HH:mm (24-hour)
-- intro_time is a time column, so cast to text first
UPDATE intros_booked
SET intro_time = to_char(
  (class_date || ' ' || trim(intro_time::text))::timestamp,
  'HH24:MI'
)::time
WHERE intro_time IS NOT NULL
  AND (intro_time::text ILIKE '%am%' OR intro_time::text ILIKE '%pm%');

-- Backfill intros_run.class_time: convert AM/PM strings to HH:mm (24-hour)
UPDATE intros_run
SET class_time = to_char(
  ('2000-01-01 ' || trim(class_time::text))::timestamp,
  'HH24:MI'
)::time
WHERE class_time IS NOT NULL
  AND (class_time::text ILIKE '%am%' OR class_time::text ILIKE '%pm%');

-- Backfill intro_questionnaires.scheduled_class_time similarly
UPDATE intro_questionnaires
SET scheduled_class_time = to_char(
  ('2000-01-01 ' || trim(scheduled_class_time::text))::timestamp,
  'HH24:MI'
)::time
WHERE scheduled_class_time IS NOT NULL
  AND (scheduled_class_time::text ILIKE '%am%' OR scheduled_class_time::text ILIKE '%pm%');
