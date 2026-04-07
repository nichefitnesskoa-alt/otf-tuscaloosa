

# Fix Coach Lead Measures Data + Funnel "Booked" Cap at Today

## Problem 1 — Coach Lead Measures shows no data

The WIG page queries `intros_run` for coach lead measures, but it filters to only 1st intros (`isSecondIntro` check via `originating_booking_id`). The query also requires an `intros_run` record linked to the booking. The issue is twofold:

1. **No `intros_run` record exists yet.** The coach card fetches the `intros_run` row on line 94 with `!isSecondIntro` guard, and `saveRunField` on line 152 bails out with `if (!runData?.id) return`. If no `intros_run` record was created for today's booking (the outcome hasn't been logged yet by an SA), the coach toggles silently fail — data is never written to the database. The coach sees the toggles change locally but nothing persists.

2. **The coach card saves to `intros_booked` for shoutout fields but to `intros_run` for goal/friend fields.** Without an `intros_run` row, the goal_why_captured and made_a_friend fields never save.

**Fix:** In `CoachIntroCard.tsx`, when no `intros_run` record exists for the booking, auto-create one when the coach first toggles a run-level field. This ensures coach lead measure data is always persisted.

## Problem 2 — Funnel "Booked" includes future intros

The `filteredBookings` on line 138 filters by `class_date` within the date range. When "This Month" is selected, the range goes to end of month, so future bookings (e.g., April 15 when today is April 7) are counted in "Booked."

**Fix:** Cap the date range end at today (Central Time) for the funnel's "Booked" count. Use `min(dateRange.end, getNowCentral())` so future bookings are excluded.

## Changes

### File 1: `src/components/coach/CoachIntroCard.tsx`

In `saveRunField`, when `runData?.id` is null, create an `intros_run` record first:
- Insert a new row with `linked_intro_booked_id = booking.id`, `member_name = booking.member_name`, `class_time = booking.intro_time`, `run_date = booking.class_date`, `coach_name = booking.coach_name`, `result = 'Pending'`, `result_canon = 'UNRESOLVED'`, plus the fields being saved.
- After insert, set `runData` with the new record's ID so subsequent saves work normally.

### File 2: `src/pages/Wig.tsx`

In the `filteredBookings` useMemo (line 138), cap the date range end at today Central Time:
```
const todayCentral = getNowCentral();
const effectiveEnd = dateRange ? (dateRange.end < todayCentral ? dateRange.end : todayCentral) : todayCentral;
```
Use `effectiveEnd` instead of `dateRange.end` for the `isWithinInterval` check, so only bookings up to today are counted in the funnel.

## What does NOT change
- Database schema — no new tables or columns
- SA view, Follow-Up tab, scripts, or any other page
- Coach card layout or styling
- Other WIG sections (SA Lead Measures, Milestones)

