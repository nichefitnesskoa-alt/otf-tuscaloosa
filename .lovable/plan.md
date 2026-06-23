## Why the numbers disagree

**Studio Scoreboard "Intros Run" = 15** is correct.
**Conversion Funnel "1st Intro · Showed" = 14** is undercounting.

Both surfaces are supposed to count the same thing — first intros where the member physically showed up in the date range. But they use two different inline definitions of "first intro" and "ran":

| Concern | Studio Scoreboard (`useDashboardMetrics.ts`) | Conversion Funnel (`ConversionFunnel.tsx`) |
|---|---|---|
| First-intro filter | `isFirstIntroForMetrics(b)` canonical helper | Local inline `isFirstBooking` that re-derives by booking date |
| Ran/showed filter | `didIntroActuallyRun(r)` canonical helper | `r.result !== 'No-show'` (legacy field, bypasses canon) |
| Person dedupe across rows | None — counts every 1st intro that ran | Removes 1st intros whose owner had a 2nd intro already pass in range (`personHasPassedSecond`) |
| Class-time gating | `pastAndTodayBookings` (time-aware) | `hasBookingPassed` (re-implemented locally) |

For pay period Jun 15 – Jun 28, **Maliyah Grant** has a 1st intro on 6/19 (ran) and a 2nd intro on 6/20 (passed). The Funnel suppresses her 1st intro to avoid double-counting her in 1st + 2nd rows, so it shows 14. The Scoreboard correctly shows 15.

**15 is the right number** by the project rule (`"Intros Run = members who physically showed up"`). 14 is a side-effect of person-level dedupe inside the Funnel.

## Plan

### 1. Use canonical helpers inside `computeFunnelBothRows` (`src/components/dashboard/ConversionFunnel.tsx`)
- Replace inline `isFirstBooking` with `isFirstIntroForMetrics(b, promotedOrphanIds)` — same helper the Scoreboard/Per-SA/Per-Coach already use.
- Replace `r.result !== 'No-show'` with `didIntroActuallyRun(r)` for the showed check on both 1st and 2nd rows. This is the canonical "did the intro actually run" predicate and is what `pipelineShowed` uses.
- Replace local `hasBookingPassed` with the same one already defined in `useDashboardMetrics.ts` — extract to `src/lib/dateUtils.ts` as `hasClassTimePassed(booking)` so both surfaces share one definition.

### 2. Remove the 1st-row person-dedupe that causes the −1
- Drop the `personHasPassedSecond` exclusion from the 1st-row filter. The 1st-row Showed should count every 1st intro that ran in range, matching Studio Scoreboard.
- Keep 2nd-row independent (it already filters to real 2nd intros). The "Total (All Intros)" row will now equal `firstShowed + secondShowed` with no person being double-suppressed; if the same person legitimately had both a 1st and a 2nd intro run in the same range, that's two ran intros and should count as two.

### 3. Extract a single canonical "ran first intros in range" helper
Add `src/lib/intros/ranFirstIntros.ts` exporting `getRanFirstIntroBookings(introsBooked, introsRun, dateRange)` returning the booking rows that count. Used by:
- `useDashboardMetrics.ts` → `pipelineShowed` / `studioIntrosRun`
- `ConversionFunnel.tsx` → `firstShowed`
- Any later surface that needs the same count (Per-SA already routes through `isFirstIntroForMetrics + didIntroActuallyRun`, will be re-pointed at this helper).

### 4. Coherence proof before close
Verify with `psql` against pay period Jun 15 – Jun 28:
- Count of bookings where `isFirstIntroForMetrics` is true, class time passed, and at least one linked run satisfies `didIntroActuallyRun` and `isRunInRange` → expect 15.
- Studio Scoreboard "Intros Run" → 15.
- Funnel "1st Intro · Showed" → 15 (was 14).
- Funnel "Total (All Intros) · Showed" ≥ 15.
- Per-SA "Ran" totals sum to 15 (minus any unattributed).
- Drill-down list on Funnel "1st Showed" includes Maliyah Grant.

### Files touched
- `src/components/dashboard/ConversionFunnel.tsx` — swap to canonical helpers, drop `personHasPassedSecond` suppression, drop local `hasBookingPassed`.
- `src/hooks/useDashboardMetrics.ts` — point `pipelineShowed` at the new shared helper, drop the local `hasBookingPassed` duplicate.
- `src/lib/intros/ranFirstIntros.ts` — new canonical helper.
- `src/lib/dateUtils.ts` — add `hasClassTimePassed`.
- Tests: update `src/components/dashboard/__tests__/conversionFunnel.test.ts` for the new canonical behavior; add a regression case for the Maliyah-shaped scenario (same person with 1st + 2nd both in range — both rows should count their respective intros).

### What does NOT change
- 2nd-intro row math, sale math, journey row, and pull-forward logic stay the same.
- Per-Coach close rate denominator stays on `didIntroActuallyRun` — already canonical.
- No DB migration, no schema change.
