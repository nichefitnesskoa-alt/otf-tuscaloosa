## Bug Fix: Follow-up purchases missing from Lead Source Analytics (COMPLETED)

### Root Cause

Lead Source Metrics block in `useDashboardMetrics.ts` (lines 363–392) iterated only over `firstIntroBookings` filtered by `class_date` in the date range. Sold was counted only when a run linked to that specific booking passed `isSaleInRange`. This missed:
1. Follow-up purchases where `buy_date` is in range but original booking's `class_date` is outside
2. 2nd intro sales that should attribute back to the original booking's lead source

### Fix Applied

**Single file changed:** `src/hooks/useDashboardMetrics.ts` (Lead Source Metrics block)

Rewrote sold counting to:
1. **Booked/showed**: Unchanged — anchored to booking `class_date` in range (1st intros only)
2. **Sold**: Iterates ALL `activeRuns` where `isSaleInRange(run, dateRange)` is true
3. **Attribution**: `run.linked_intro_booked_id` → if 2nd intro, follow `originating_booking_id` → get lead source from original booking. Fallback: name-based matching to earliest 1st intro. Final fallback: "Unknown"
4. **No double-counting**: `countedRunIds` Set prevents any run from being counted twice

### Files Audited — No Change Needed

| File | Reason |
|---|---|
| `src/components/dashboard/ConversionFunnel.tsx` | Already iterates all runs with `isSaleInRange` — correct |
| `src/hooks/useDashboardMetrics.ts` per-SA section | Already uses dual-date filtering — correct |
| `src/hooks/useDashboardMetrics.ts` pipeline section | Only counts past+today bookings for show rate — correct by design |
| `src/hooks/useDashboardMetrics.ts` studio metrics | Aggregates from per-SA — correct |
| `supabase/functions/post-groupme/index.ts` | Counts same-day sales separately by date — correct |
| `src/components/dashboard/CloseOutShift.tsx` | Counts same-day sales separately — correct |
| `src/hooks/useLeadMeasures.ts` | Shows ran/booked counts per SA, not sold — unaffected |
| `src/components/dashboard/LeadSourceChart.tsx` | Pure display component — unaffected |
| `src/lib/sales-detection.ts` | Shared utilities — correct |

### Verification

- Lead Source total sold now = Conversion Funnel total sold for any date range
- Follow-up purchases with `buy_date` in range appear under correct lead source
- `book→sale` rate recalculates: denominator = 1st intros booked in range, numerator = all sales with purchase date in range
- No regression to other metrics sections
