## Goal
Add a second row to the **Studio Scoreboard** that mirrors the existing row using the **OTF Corporate · Last Coach** logic (every ran class counts, 1st AND 2nd intros). Keep the current row as **Internal · Total Journey** and clearly label each.

## Layout

```
Studio Scoreboard
─────────────────────────────────────────────
Internal · Total Journey          (1st intros only)
  44 Intros Run   20 Sales   45% Close Rate
  "Close rate is total journey. A sale counts on
   its first intro's chain…"

─────────────────────────────────────────────
OTF Corporate · Last Coach        (1st + 2nd intros)
  57 Intros Run   20 Sales   35% Close Rate
  "Every ran class counts. This is how OTF
   corporate measures studio close rate."
─────────────────────────────────────────────
Includes VIP-sourced intros & sales
```

Both rows share the same Sales count (total memberships sold in range). Only the **Intros Run denominator** changes, which changes the **Close Rate**.

## Logic

### Row 1 — Internal · Total Journey (existing, unchanged)
- `introsRun` = `pipelineShowed` (1st-intro bookings that ran)
- `sales` = `studioIntroSales`
- `closeRate` = sales / max(introsRun, sales)

### Row 2 — OTF Corporate · Last Coach (new)
Add to `useDashboardMetrics.ts` alongside the existing studio block:
- `introsRunAll` = count of every row in `activeRuns` where `didIntroActuallyRun(r)` is true and `isRunInRange(r, dateRange)` — no 1st-intro filter, includes 2nd intros.
- `salesAll` = same as `studioIntroSales` (already counts every sale in range).
- `closeRateAll` = salesAll / max(introsRunAll, salesAll).

Expose as `studio.introsRunCorporate` / `studio.closingRateCorporate` (sales stays single field).

### Component
Update `StudioScoreboard.tsx` props to accept the corporate trio plus the existing trio, render two stacked 3-col rows with a divider and a header label on each row, keep tooltips, keep the VIP footer.

## Files to touch
- `src/hooks/useDashboardMetrics.ts` — compute `introsRunCorporate` + `closingRateCorporate`, add to returned `studio` object.
- `src/components/dashboard/StudioScoreboard.tsx` — new props, two-row layout with section labels.
- `src/pages/Recaps.tsx` + `src/features/myDay/MyDayTopPanel.tsx` — pass the two new props through.

## Coherence
- Row 2 denominator must equal the **denominator used in the Corporate · Last Coach coach table** on `/wig` (sum of every ran class across all coaches).
- Row 1 stays equal to the existing Studio Funnel "showed" count.
- Verify with read_query that `count(ran rows in range) = row2 introsRun` and `count(ran rows linked to 1st-intro bookings) = row1 introsRun`.
