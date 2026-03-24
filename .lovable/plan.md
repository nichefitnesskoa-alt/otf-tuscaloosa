# Fix Per-SA Performance: Rename "Booked" → "Ran" + Pull Forward Intros for Sales

## Problem

Kayla shows 0 Booked, 1 Sale, 0% Close. The sale's buy_date is in the period but the original intro was booked outside the period, so the booking count is 0 and close rate computes as 0/0 = 0%. This is misleading.

## Changes

### 1. Rename "Booked" → "Ran" everywhere in PerSATable

- Column header: "Booked" → "Ran"
- Subtitle: "Total Journey · 1st booked → any sale" → "Total Journey · 1st ran → any sale"
- Interface field: `introsBooked` stays as-is internally (too many references to rename safely), but display text changes  


### 2. Change the denominator from "1st bookings in range" to "1st intros ran in range" (`useDashboardMetrics.ts`)

- Instead of counting `firstIntroBookings` filtered by `class_date` in range, count first-intro **runs** (showed, not no-show) where `run_date` is in range
- This aligns the label with the actual metric

### 3. Pull forward: if a sale is in the period but the original intro ran outside the period, count that intro toward the "Ran" denominator

- After computing sales for each SA, check: if `salesCount > 0` but `introsRanCount === 0`, find the runs that produced those sales and add their originating first-intro to the ran count
- Simpler approach: for each sale found in range, also count its linked first-intro booking as "ran" (if not already counted). This ensures the denominator always includes at least the intros that produced in-period sales
- Close rate = sales / max(ran count, sales count) — this prevents >100% and prevents 0-denominator

### 4. Update close rate threshold check in leaderboard filter

- Line 610: `m.introsBooked >= MIN_INTROS_FOR_CLOSING` stays the same field name but now reflects ran count

## Files Changed


| File                                      | Change                                                                                                                 |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `src/hooks/useDashboardMetrics.ts`        | Change perSA `introsBooked` to count 1st intros **ran** (not booked) in range; pull forward intros for in-period sales |
| `src/components/dashboard/PerSATable.tsx` | Rename column header "Booked" → "Ran", update subtitle                                                                 |


## Technical Detail

In `useDashboardMetrics.ts` around line 240-325:

```typescript
// NEW: Count 1st intros RAN (showed) by this SA in date range
const saFirstRuns = activeRuns.filter(run => {
  if (run.intro_owner !== saName) return false;
  if (!run.linked_intro_booked_id || !firstIntroBookingIds.has(run.linked_intro_booked_id)) return false;
  const res = (run.result || '').toLowerCase();
  if (res === 'no-show' || res === 'no show') return false;
  return isRunInRange(run, dateRange);
});
let introsRanCount = saFirstRuns.length;

// After computing salesCount...
// Pull forward: ensure denominator >= salesCount
const effectiveRan = Math.max(introsRanCount, salesCount);
const closingRate = effectiveRan > 0 ? (salesCount / effectiveRan) * 100 : 0;
```

  
Make sure you make any relevant subsequent changes app wide that makes sense to based off on the changes we're making to keep things efficient, clear and the same