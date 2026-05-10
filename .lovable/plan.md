**EDITS TO LOVABLE'S PLAN**

**1. Lock the coach color map in a constants file.** Plan says `colorForCoach()` exists. Confirm it returns the same hex for the same name every time, stored in `src/lib/scorecard/coachColors.ts` as an explicit object, not a hash function. Hash functions reassign colors when the coach list changes.

```
KOA: #E8540A (OTF orange reserved for Studio line — pick different for Koa)
Koa: pick a distinct hex
James: distinct hex
Nathan: distinct hex
... locked per coach, never reassigned
```

Studio line keeps OTF orange exclusively. No coach gets orange.

**2. Studio line visual hierarchy.** Studio overall = OTF orange, 3px stroke, solid, rendered last so it sits on top. Coach lines = 1.5px stroke, their assigned color. Studio dot markers larger than coach markers.

**3. Drill-down click payload must include series name.** Plan mentions this. Be explicit in the prompt: clicking a point passes both `bucket` AND `seriesName` (either "Studio" or the coach name). The drill-down dialog filters scorecards by that series. Without this, clicking Koa's line on May 8 could open all coaches' scorecards from May 8.

**4. Persist legend toggle state across tab switches.** If you hide James on the Avg Score tab and switch to Avg Score · Closed, James should stay hidden. Otherwise the SA toggles the same coach off twice and gives up.

**5. Empty-state message specificity.** Plan says "No formal evals in this range yet." Make it actionable: "No formal evals in this range. Formal evals run on alternating weeks. Next formal week: [date]."

If you don't track formal-week cadence in data yet, flag CONFIRM THIS VALUE and use the generic message for now.

---

**ONE MORE THING THE PLAN MISSED**

The "Tap a coach to see their trend" instruction at the top of the section. With multi-coach overlay now default, that instruction is outdated. Update it to:

"Every coach's first visits, scored. Tap a coach in the legend to isolate. Tap a point to open the scorecards behind it."  
  
  
First Visit Experience — multi-coach overlay + closed-score chart

Scope: `src/components/scorecard/WigFirstVisitSection.tsx` (chart UI + toggles). Uses existing `data.perCoachPoints`, `closedPoints`, `notClosedPoints` from `useFvTrendData` plus `colorForCoach()` helper.

### Changes

1. **Default to Self Evals**
  - Initial `primary` state: `'self'` (was `'formal'`).
2. **Rename toggle labels**
  - `Formal primary` → `Formal Evals`
  - `Self primary` → `Self Evals`
3. **Hide chart when no data for current eval type**
  - When `primary === 'formal'` and there are no formal scorecards in range, render an empty-state message instead of the chart ("No formal evals in this range yet."). Same logic already needed for self.
  - Detection: count `data.scorecards.filter(submitted_at && eval_type === <primary>_eval).length`.
4. **Add chart-mode tabs above the Studio chart**
  - Two tabs: **Avg Score** (default) and **Avg Score · Closed**.
  - "Avg Score" shows the existing studio-overall data (avg of all primary scorecards by date).
  - "Avg Score · Closed" plots each point as the avg score of intros that closed (uses `closedPoints` already returned).
5. **Multi-coach overlay on the default chart**
  - In the Studio chart card, render one line per coach who has at least one primary scorecard point in range, plus the studio overall line on top (bolder).
  - Coach lines from `data.perCoachPoints` (already keyed by coach). Skip coaches with all-null series.
  - Color: `colorForCoach(coachName)` from `src/lib/scorecard/coachColors.ts`. Studio line stays OTF orange and thicker.
  - Shared X axis is the same bucket list as studio. Merge per-coach values onto one dataset by `bucket` so Recharts renders aligned points.
  - Legend lists each coach; tap a legend item filters to that coach (Recharts default toggle is fine).
  - Same behavior on the "Avg Score · Closed" tab — one line per coach using only that coach's closed scorecards (compute inline by filtering `closedCards` per coach the same way `closedPoints` is built; reuse `buildTrendPoints` from `@/lib/scorecard/trends` — no hook signature change needed because `closedCards` is already exposed).
6. **Drill-down on click**
  - Clicking any point on either chart opens the existing `drilldown` dialog with the cards behind that bucket.
  - For the studio overall line: existing behavior (cards from that bucket across all coaches).
  - For a coach line: filter that bucket's cards to `evaluatee_name === coach`.
  - For the "Closed" chart: filter to closed cards only (from `closedCards`).
  - Implement via Recharts `onClick` on `<Line>` elements (passes payload with bucket + series name) OR keep chart-level onClick and read the active series from the tooltip payload.

### Out of scope (already done in prior turns)

- 4-week-avg toggle, date range filter, unscored badges, coach leaderboard, cadence dots — all stay as-is.

### Files to touch

- `src/components/scorecard/WigFirstVisitSection.tsx` — toggle labels + default, chart-mode tab state, empty-state for no-data primary, rewrite `TrendChart` (or branch inline) to render multi-coach lines and handle per-series drilldown.

No data-layer or DB changes. No changes to `useFvTrendData` API.