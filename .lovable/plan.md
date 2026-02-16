

# Unify Sales Date Logic Across the Entire App

## Problem
Three places calculate sales metrics independently with diverging logic:
1. `useDashboardMetrics.ts` -- recently fixed with dual-date filtering (inline)
2. `useMeetingAgenda.ts` -- still queries `intros_run` filtered by `run_date` only (SQL-level), missing follow-up purchases
3. `src/lib/sales-detection.ts` -- already has shared `getSaleDate()` and `isDateInRange()` but neither hook uses them

## Changes

### 1. Extend `src/lib/sales-detection.ts` with new shared utilities

Add three new exported functions alongside the existing `getSaleDate` and `isDateInRange`:

```typescript
import { DateRange } from '@/lib/pay-period';
import { parseLocalDate } from '@/lib/utils';
import { isWithinInterval } from 'date-fns';

// Existing getSaleDate stays as-is (4-param version for components)

// New: simplified version for IntroRun objects
export function getRunSaleDate(run: { buy_date?: string | null; run_date?: string | null; created_at: string }): string {
  return run.buy_date || run.run_date || run.created_at.split('T')[0];
}

// New: check if a run's run_date falls in a DateRange
export function isRunInRange(
  run: { run_date?: string | null },
  dateRange: DateRange | null
): boolean {
  if (!dateRange) return true;
  if (!run.run_date) return false;
  const date = parseLocalDate(run.run_date);
  return isWithinInterval(date, { start: dateRange.start, end: dateRange.end });
}

// New: check if a run qualifies as a sale in a DateRange
export function isSaleInRange(
  run: { buy_date?: string | null; run_date?: string | null; result?: string; created_at: string },
  dateRange: DateRange | null
): boolean {
  if (!dateRange) return true;
  if (!isMembershipSale(run.result || '')) return false;
  const saleDate = getRunSaleDate(run);
  const date = parseLocalDate(saleDate);
  return isWithinInterval(date, { start: dateRange.start, end: dateRange.end });
}
```

### 2. Refactor `src/hooks/useDashboardMetrics.ts`

Replace all inline date-fallback logic with imports from `sales-detection.ts`:
- Remove the local `isMembershipSaleLocal` function -- import `isMembershipSale` from `sales-detection.ts`
- Replace `run.buy_date || run.run_date` patterns with `getRunSaleDate(run)`
- Replace inline sale-date checks with `isSaleInRange(run, dateRange)`
- Replace inline run-date checks with `isRunInRange(run, dateRange)`
- Add the close rate edge case comment at the close rate calculation

### 3. Fix `src/hooks/useMeetingAgenda.ts` (the critical bug)

**Problem**: The SQL query on line 214 filters `intros_run` by `run_date` range, so follow-up purchases with `buy_date` in range but `run_date` outside are never fetched.

**Fix**: Broaden the `intros_run` query to also fetch runs where `buy_date` falls in the date range. Change:
```sql
.gte('run_date', startStr).lte('run_date', endStr)
```
to fetch runs where EITHER `run_date` is in range OR `buy_date` is in range (using an `.or()` filter):
```typescript
supabase.from('intros_run')
  .select('id, member_name, result, sa_name, intro_owner, primary_objection, linked_intro_booked_id, run_date, buy_date, commission_amount, lead_source, ignore_from_metrics')
  .or(`and(run_date.gte.${startStr},run_date.lte.${endStr}),and(buy_date.gte.${startStr},buy_date.lte.${endStr})`)
```

Then update the metrics calculations:
- `showed` count: filter by `run_date` in range and not no-show (booking metric)
- `sales` count: filter by `isSaleInRange` using `buy_date` fallback (conversion metric)
- `closeRate`: Sales (purchase-date) / Showed (run-date)
- Same fix for previous period query

Also update `generateShoutoutCategories` to use the same dual-date logic:
- "Intros Showed" and "Show Rate" use `run_date`
- "Total Sales" and "Close Rate" use `isSaleInRange`

### 4. Add close rate edge case comment

In both `useDashboardMetrics.ts` and `useMeetingAgenda.ts`, add near the close rate calculation:
```
// Close Rate = Sales (purchase-date filtered) / Intros Showed (run-date filtered)
// This can exceed 100% when follow-up purchases from previous periods
// land in a period with fewer new intros. This is correct behavior:
// it reflects real revenue attribution for the selected period.
```

### 5. AMC auto-increment verification (no changes needed)

Verified: `FollowupPurchaseEntry.tsx` already passes `purchaseDate` (the buy_date) to `incrementAmcOnSale`. `ShiftRecap.tsx` passes the shift date. The AMC logic correctly uses whatever date is passed to it. No changes required.

### 6. Verification checklist (post-implementation)

After changes, verify:
- Sophie shows correct sales count on Studio Scoreboard
- Team Meeting agenda shows same sales count as Scoreboard for the same date range
- Changing to "Last Pay Period" does not double-count sales
- Conversion funnel (Booked / Showed / Sold) is internally consistent
- Members Who Bought panel matches Scoreboard sales count

### Files to modify
1. `src/lib/sales-detection.ts` -- add `getRunSaleDate`, `isRunInRange`, `isSaleInRange`
2. `src/hooks/useDashboardMetrics.ts` -- replace inline logic with shared utilities
3. `src/hooks/useMeetingAgenda.ts` -- broaden SQL query + use shared utilities for counting

### Files verified, no changes needed
- `src/lib/amc-auto.ts` -- AMC increment already uses passed date correctly
- `src/components/FollowupPurchaseEntry.tsx` -- passes buy_date to AMC
- `src/components/admin/MembershipPurchasesPanel.tsx` -- already uses `getSaleDate` correctly
- `src/lib/studio-metrics.ts` -- shared constants only

