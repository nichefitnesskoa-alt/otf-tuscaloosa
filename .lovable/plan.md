
# Fix Show Rate to Exclude Future Events + Consistency Sweep

## Problem

Show rate is calculated as `showed / booked`, but "booked" includes future bookings that haven't happened yet. At the beginning of a pay period, if 18 intros are booked for the week but only 3 have occurred so far, the show rate uses 18 as the denominator instead of 3, making it appear artificially low.

This affects three surfaces:
- Studio Scoreboard (via pipeline metrics)
- Booker Stats table
- Team Meeting scoreboard

## Root Cause

`firstIntroBookings` in `useDashboardMetrics.ts` filters by `class_date` within the selected date range but does not exclude future dates. The same pattern exists in `useMeetingAgenda.ts`.

## Solution

### Change 1: useDashboardMetrics.ts

Add a `todayYMD` variable using the existing `getTodayYMD()` utility from `src/lib/dateUtils.ts`.

Create a new filtered list `pastAndTodayBookings` from `firstIntroBookings` that only includes bookings where `class_date <= todayYMD`. Use this filtered list as the denominator for:

- **Pipeline metrics** (line 375): `pipelineBooked` uses `pastAndTodayBookings.length` instead of `firstIntroBookings.length`. The "showed" loop also iterates only over `pastAndTodayBookings`.
- **Booker stats** (line 317): The `.forEach` that counts booked/showed per SA uses `pastAndTodayBookings` for the show rate denominator. However, the "introsBooked" column should still show ALL bookings (including future) since that's a booking activity metric, not an attendance metric. So booker stats will use a dual approach: total booked from `firstIntroBookings`, show rate denominator from `pastAndTodayBookings`.
- **Lead source metrics** (line 350): Same pattern -- showed/show rate uses only past+today bookings.

The `firstIntroBookings` list itself is NOT changed -- it still includes future bookings because other metrics (like "Intros Booked" count in the scoreboard) correctly should include future bookings. Only show rate and no-show calculations use the filtered set.

### Change 2: useMeetingAgenda.ts

Line 380: Replace `filteredBooked.length` with a count of only bookings where `class_date <= todayYMD`. Since meeting agendas are typically generated for a past week this rarely matters, but it prevents the same bug if someone generates mid-week.

### Change 3: StudioScoreboard display

Update the scoreboard to display two separate "Booked" numbers:
- "Booked" stays as-is (total bookings in range, including future)  
- The show rate tooltip clarifies: "Showed / Booked (past + today only)" so it's obvious future events are excluded

The no-shows calculation (`introsBooked - introsShowed`) will also use the past+today denominator so it doesn't count future bookings as no-shows.

### Change 4: MyDayTopPanel props

`MyDayTopPanel.tsx` passes `metrics.pipeline.booked` and `metrics.pipeline.showed` to `StudioScoreboard`. The pipeline metrics will now reflect the corrected denominator, so no changes needed in MyDayTopPanel itself -- it just passes through.

## Files Modified

| File | What Changes |
|------|-------------|
| `src/hooks/useDashboardMetrics.ts` | Add `pastAndTodayBookings` filter; use it for show rate denominator in pipeline, booker stats, and lead source metrics |
| `src/hooks/useMeetingAgenda.ts` | Filter show rate denominator to past+today bookings |
| `src/components/dashboard/StudioScoreboard.tsx` | Update no-shows tooltip to clarify past+today only |

No features removed. No database changes. No new files.
