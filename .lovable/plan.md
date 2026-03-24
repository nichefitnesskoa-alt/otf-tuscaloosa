

# Per-SA Performance: Only Include Intro Sales, Hide SAs With No Intro Activity

## Problem
Bri appears in the Per-SA table with 0/0/0% because the filter still checks `m.commission > 0`, which includes outside/walk-in sales commission. Per-SA Performance should only reflect **intro sales** — not outside or walk-in sales.

## Changes (`src/hooks/useDashboardMetrics.ts`)

1. **Remove outside sales commission** from Per-SA computation (delete lines 329-336 that query `sales` table for outside commission)
2. **Remove `commission` from the return object** — it was already removed from the UI but still computed and used in the filter
3. **Update the filter** on line 345 from `m.introsBooked > 0 || m.sales > 0 || m.commission > 0` to just `m.introsBooked > 0 || m.sales > 0`
4. **Remove unlinked run sales** from `salesCount` (lines 312-317) — unlinked runs are outside/walk-in sales that aren't tied to a booking; they shouldn't count in Per-SA intro performance

This ensures only SAs who have ran intros or closed intro-linked sales appear in the table. Bri, who only had outside sales, will no longer show up.

