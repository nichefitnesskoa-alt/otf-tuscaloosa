
CREATE OR REPLACE VIEW public.coach_wig_summary AS
WITH quarter_bounds AS (
  SELECT
    date_trunc('quarter', CURRENT_DATE)::date AS q_start,
    (date_trunc('quarter', CURRENT_DATE) + interval '3 months' - interval '1 day')::date AS q_end
),
first_intros AS (
  SELECT
    ir.id AS run_id,
    ir.coach_name,
    ir.goal_why_captured,
    ir.made_a_friend,
    ib.coach_brief_why_moment,
    ib.coach_shoutout_start,
    ib.coach_shoutout_end,
    ib.coach_referral_asked
  FROM public.intros_run ir
  JOIN public.intros_booked ib ON ib.id = ir.linked_intro_booked_id
  CROSS JOIN quarter_bounds qb
  WHERE ib.originating_booking_id IS NULL
    AND ib.booking_type_canon = 'STANDARD'
    AND ir.run_date::date >= qb.q_start
    AND ir.run_date::date <= qb.q_end
    AND ib.deleted_at IS NULL
)
SELECT
  coach_name,
  count(*) AS total_first_intros_coached,
  round(100.0 * count(*) FILTER (WHERE coach_brief_why_moment IS NOT NULL AND coach_brief_why_moment <> '') / NULLIF(count(*), 0), 1) AS prepped_rate,
  round(100.0 * count(*) FILTER (WHERE coach_shoutout_start = true) / NULLIF(count(*), 0), 1) AS shoutout_start_rate,
  round(100.0 * count(*) FILTER (WHERE coach_shoutout_end = true) / NULLIF(count(*), 0), 1) AS shoutout_end_rate,
  round(100.0 * count(*) FILTER (WHERE goal_why_captured = 'yes') / NULLIF(count(*), 0), 1) AS why_used_rate,
  round(100.0 * count(*) FILTER (WHERE made_a_friend = true) / NULLIF(count(*), 0), 1) AS member_intro_rate,
  round(100.0 * count(*) FILTER (WHERE coach_referral_asked = true) / NULLIF(count(*), 0), 1) AS referral_ask_rate
FROM first_intros
WHERE coach_name IS NOT NULL
GROUP BY coach_name;
