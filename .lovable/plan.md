

# Fix: Sales Count Mismatch Between Scoreboard and Members Who Bought

## Problem
The Studio Scoreboard shows fewer sales than "Members Who Bought" because of a filtering bug in `useDashboardMetrics.ts`. The code filters runs by `run_date` first, which drops follow-up purchases where the intro was run in a previous period but the sale closed in the current period. Three of Sophie's sales are invisible to the scoreboard for this reason.

## Root Cause
Line 183-186 of `useDashboardMetrics.ts`:
```
const saRuns = activeRuns.filter(run => {
  const runDateInRange = isDateInRange(run.run_date, dateRange);
  return run.intro_owner === saName && runDateInRange && run.result !== 'No-show';
});
```
This pre-filter by `run_date` means any run whose `run_date` is outside the period is excluded entirely, even if `buy_date` falls inside the period.

## Solution: Dual-Pass Approach

Implement the documented dual-date filtering logic: booking-based metrics (intros run) use `run_date`, while conversion-based metrics (sales, close rate, commission) use the purchase date fallback chain (`buy_date > run_date > created_at`).

### Changes to `src/hooks/useDashboardMetrics.ts`

**Per-SA Metrics (lines ~180-278):**
1. Expand the initial run filter to include runs where EITHER `run_date` is in range OR `buy_date` is in range (so follow-up purchases are not dropped).
2. When counting `introsRunCount`, only count runs whose `run_date` is in range (booking-based metric).
3. When counting `salesCount`, use the sale date (`buy_date || run_date`) to determine if the sale falls in the period (conversion-based metric).
4. This means a run with `run_date` outside the range but `buy_date` inside the range contributes to sales count but NOT to intros run count -- which is the correct behavior per the documented rules.

**Pipeline Metrics (lines ~354-379):**
Apply the same dual-date logic: filter bookings by `class_date` for the "booked" count, but check sale date for the "sold" count.

**Lead Source Metrics (lines ~326-350):**
Same fix: sale date check uses `buy_date || run_date`.

**Studio Metrics (lines ~413-417):**
These aggregate from perSA, so they inherit the fix automatically.

### Specific Code Change

Replace the single `saRuns` filter with a broader filter, then apply the date distinction inside the counting loops:

```typescript
// Get ALL runs by this SA (filter by owner, exclude no-shows, exclude VIP)
const saAllRuns = activeRuns.filter(run => {
  return run.intro_owner === saName && run.result !== 'No-show';
});

// Separate: runs whose run_date is in range (for intros-run count)
// AND runs whose sale date is in range (for sales count)
const saRunDateInRange = saAllRuns.filter(r => isDateInRange(r.run_date, dateRange));
const saSaleDateInRange = saAllRuns.filter(r => {
  const saleDate = r.buy_date || r.run_date;
  return isMembershipSale(r.result) && isDateInRange(saleDate, dateRange);
});
```

Then group by booking using the union of both sets, count intros run from `saRunDateInRange`, and count sales from `saSaleDateInRange`.

### Close Rate Calculation

Close Rate = Sales (purchase-date filtered) / Intros Showed (run-date filtered). This is correct: it answers "of the people who showed up in this period, how many eventually bought (including follow-up purchases whose buy_date falls in this period)."

Note: This means close rate can theoretically exceed 100% in edge cases where many follow-up purchases land in a period with few new intros. This is acceptable and accurate -- it reflects real revenue attribution.

### No Other Files Need Changes

- `MembershipPurchasesPanel.tsx` already uses `getSaleDate()` correctly
- `StudioScoreboard.tsx` receives props from the hook, no changes needed
- `useMeetingAgenda.ts` does its own query but uses similar logic; will verify and align if needed
- `studio-metrics.ts` has shared constants only, no changes needed

