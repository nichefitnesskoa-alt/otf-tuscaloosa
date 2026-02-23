

# Fix No-Shows to Count Only True No-Shows

## Problem

No-shows are currently calculated as `introsBooked - introsShowed`, which incorrectly counts:
- **Cancellations** as no-shows
- **Reschedules** as no-shows
- **Today's intros that haven't happened yet** as no-shows

Only bookings with an actual `result === 'No-show'` in `intros_run` should count.

## Solution

### Change 1: Explicit no-show count in `useDashboardMetrics.ts`

Instead of deriving no-shows as `booked - showed`, count them explicitly:
- Loop through `pastAndTodayBookings` and check if the booking has a linked run with `result === 'No-show'`
- Only those count as no-shows
- Additionally, tighten `pastAndTodayBookings` to exclude today's bookings that have no run record yet (they haven't happened), by filtering to `class_date < todayYMD` OR bookings that have at least one run in `bookingToRuns`

Add `noShows` to the `PipelineMetrics` interface and compute it explicitly in the pipeline section.

### Change 2: Update `StudioScoreboard.tsx`

- Accept `noShows` as a prop from pipeline metrics instead of computing it as `booked - showed`
- Remove the `const noShows = introsBooked - introsShowed` calculation
- Update tooltip: "Intros with a confirmed No-show result. Cancels and reschedules excluded."

### Change 3: Pass `noShows` through from the pipeline

Update `MyDayTopPanel.tsx` (or wherever `StudioScoreboard` is called) to pass `metrics.pipeline.noShows` as a prop.

## Files Modified

| File | What Changes |
|------|-------------|
| `src/hooks/useDashboardMetrics.ts` | Add explicit no-show count to pipeline metrics; tighten pastAndTodayBookings to exclude today's un-occurred intros |
| `src/components/dashboard/StudioScoreboard.tsx` | Accept `noShows` prop instead of computing it; update tooltip |
| `src/features/myDay/MyDayTopPanel.tsx` | Pass `pipeline.noShows` to StudioScoreboard |

No database changes. No features removed.

