

# Fix: isSaleInRange Returns True for Non-Sales in "All Time" Mode

## Root Cause

In `src/lib/sales-detection.ts`, the `isSaleInRange()` function checks for null dateRange **before** checking if the run is actually a membership sale. When dateRange is null (All Time), it short-circuits and returns `true` for every run, making every intro that showed up count as a sale.

## Fix

Swap the order of the two early-return checks in `isSaleInRange()`:

```typescript
export function isSaleInRange(run, dateRange) {
  if (!isMembershipSale(run.result || '')) return false;  // Always check this first
  if (!dateRange) return true;  // Then handle "all time"
  // ... rest of date logic
}
```

This ensures non-sale results are always filtered out, regardless of whether a date range is selected.

## File to modify
- `src/lib/sales-detection.ts` -- swap lines in `isSaleInRange` (2-line change)

## Technical Details
- The `isRunInRange` function's null-dateRange handling is correct (it doesn't need a result check).
- Every consumer of `isSaleInRange` across `useDashboardMetrics.ts` and `useMeetingAgenda.ts` will automatically get the fix since they all call this shared utility.

