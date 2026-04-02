
CREATE OR REPLACE VIEW public.sa_wig_summary AS
WITH quarter_bounds AS (
  SELECT
    date_trunc('quarter', CURRENT_DATE)::date AS q_start,
    (date_trunc('quarter', CURRENT_DATE) + interval '3 months' - interval '1 day')::date AS q_end
),
shifts AS (
  SELECT
    c.sa_name,
    c.shift_date,
    COUNT(*) FILTER (WHERE c.completed = true) AS completed_tasks
  FROM public.shift_task_completions c, quarter_bounds q
  WHERE c.shift_date BETWEEN q.q_start AND q.q_end
  GROUP BY c.sa_name, c.shift_date
),
shift_agg AS (
  SELECT
    sa_name,
    COUNT(DISTINCT shift_date) AS total_shifts_worked,
    ROUND(AVG(completed_tasks), 1) AS avg_tasks_completed_per_shift
  FROM shifts
  GROUP BY sa_name
),
outreach AS (
  SELECT
    o.sa_name,
    SUM(o.cold_dms_sent) AS total_dms_sent,
    SUM(o.cold_texts_sent) AS total_texts_sent
  FROM public.daily_outreach_log o, quarter_bounds q
  WHERE o.log_date BETWEEN q.q_start AND q.q_end
  GROUP BY o.sa_name
),
bookings AS (
  SELECT
    COALESCE(b.booked_by, b.intro_owner) AS sa_name,
    COUNT(*) AS intros_booked_count,
    COUNT(*) FILTER (WHERE b.booking_status_canon = 'SHOWED') AS showed_count
  FROM public.intros_booked b, quarter_bounds q
  WHERE b.class_date BETWEEN q.q_start AND q.q_end
    AND b.deleted_at IS NULL
    AND COALESCE(b.ignore_from_metrics, false) = false
  GROUP BY COALESCE(b.booked_by, b.intro_owner)
),
runs AS (
  SELECT
    COALESCE(r.sa_name, r.ran_by) AS sa_name,
    COUNT(*) AS total_runs,
    COUNT(*) FILTER (WHERE r.result_canon = 'SALE') AS sales
  FROM public.intros_run r, quarter_bounds q
  WHERE r.run_date BETWEEN q.q_start AND q.q_end
    AND COALESCE(r.ignore_from_metrics, false) = false
  GROUP BY COALESCE(r.sa_name, r.ran_by)
),
referrals AS (
  SELECT
    COALESCE(b.booked_by, b.intro_owner) AS sa_name,
    COUNT(*) AS total_eligible,
    COUNT(*) FILTER (WHERE b.coach_referral_asked = true) AS asked
  FROM public.intros_booked b, quarter_bounds q
  WHERE b.class_date BETWEEN q.q_start AND q.q_end
    AND b.deleted_at IS NULL
    AND b.originating_booking_id IS NULL
  GROUP BY COALESCE(b.booked_by, b.intro_owner)
)
SELECT
  COALESCE(s.sa_name, o.sa_name, bk.sa_name, rn.sa_name) AS sa_name,
  COALESCE(s.total_shifts_worked, 0) AS total_shifts_worked,
  COALESCE(s.avg_tasks_completed_per_shift, 0) AS avg_tasks_completed_per_shift,
  COALESCE(o.total_dms_sent, 0) AS total_dms_sent,
  COALESCE(o.total_texts_sent, 0) AS total_texts_sent,
  CASE WHEN COALESCE(ref.total_eligible, 0) > 0
    THEN ROUND((ref.asked::numeric / ref.total_eligible) * 100, 1)
    ELSE 0 END AS referral_ask_rate,
  COALESCE(bk.intros_booked_count, 0) AS intros_booked_count,
  CASE WHEN COALESCE(bk.intros_booked_count, 0) > 0
    THEN ROUND((bk.showed_count::numeric / bk.intros_booked_count) * 100, 1)
    ELSE 0 END AS show_rate,
  CASE WHEN COALESCE(rn.total_runs, 0) > 0
    THEN ROUND((rn.sales::numeric / rn.total_runs) * 100, 1)
    ELSE 0 END AS close_rate
FROM shift_agg s
FULL OUTER JOIN outreach o ON o.sa_name = s.sa_name
FULL OUTER JOIN bookings bk ON bk.sa_name = COALESCE(s.sa_name, o.sa_name)
FULL OUTER JOIN runs rn ON rn.sa_name = COALESCE(s.sa_name, o.sa_name, bk.sa_name)
FULL OUTER JOIN referrals ref ON ref.sa_name = COALESCE(s.sa_name, o.sa_name, bk.sa_name)
WHERE COALESCE(s.sa_name, o.sa_name, bk.sa_name, rn.sa_name) IS NOT NULL;
