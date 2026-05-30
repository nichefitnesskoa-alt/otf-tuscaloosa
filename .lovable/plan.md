## 1. Week-by-week coach scorecard grid in First Visit Experience

In `src/components/scorecard/WigFirstVisitSection.tsx`, replace the multi-line trend chart (`MultiCoachTrendChart` block, ~lines 158–200) with a week-by-week table — same shape as the existing `CoachScorecardGrid` used in the Meeting view.

Table:
- Rows: each active coach
- Columns: last 6 weeks (Mon–Sun, CST), labeled `wk M/d`
- Cells: the **average** of all scorecards (of the currently-toggled type: Self or Formal) that coach received in that week, rendered as `XX.X/30` with the existing color thresholds (≥25 success / ≥12 warning / else destructive). Empty cell = `X` in destructive.
- Tooltip on a cell lists individual scores behind the average.
- Tap a cell → opens the existing `drilldown` modal with that week's scorecards for that coach (so the existing per-cell click-through behavior stays).

Keep above the table:
- The Raw / 4-week avg toggle is removed (no longer relevant — grid is a fixed 6-week view).
- Keep the **Self Evals / Formal Evals** toggle (drives which scorecards average into each cell).
- Keep the "X intros still waiting on a scorecard" badge.
- Keep the chart-mode toggle? No — remove "Avg Score · Closed" mode (line-chart only). Grid stays one view.

Everything below the chart stays as-is: `ClosingTiles`, Coach leaderboard, drill-down dialogs.

I'll lift the grid logic into a shared component (`CoachScorecardGrid` already exists at `src/components/meeting/CoachScorecardGrid.tsx`) — extend it to accept `mode: 'best' | 'avg'` and `evalType: 'self' | 'formal' | 'all'` plus an optional `onCellTap` so both the Meeting view (best score, all) and the WIG view (average, filtered by toggle) can share one component. Move it to `src/components/scorecard/CoachScorecardGrid.tsx` and update the Meeting import.

## 2. Hide inactive staff from WIG

Root cause: `src/types/index.ts` exports `COACHES` as a hardcoded array including `'Georgia'`. Anywhere that iterates `COACHES` (instead of `useActiveStaff().coaches`) keeps showing her after deactivation.

Audit + fix in WIG-adjacent surfaces:
- `CoachScorecardGrid` — currently iterates `COACHES`. Switch to `useActiveStaff().coaches` so deactivated coaches drop out of the grid rows. (Fixes the new First Visit grid + Meeting grid in one shot.)
- `src/pages/Wig.tsx` line 1002–1004 — `COACHES[0]` / `[...COACHES]` passed to a picker. Replace with active coaches from `useActiveStaff()`.
- Coach leaderboard in `WigFirstVisitSection` already iterates `data.ranByCoach`, so it's data-driven — but I'll also filter that entries list against `useActiveStaff().coaches` so a deactivated coach with stale ran-intros in the range no longer renders.
- Per-Coach Coached/Closes table in `Wig.tsx` — verify the rendered rows come from `coachMap` (data-driven). If it renders zero-rows for `COACHES`, switch the iteration source to active coaches.

Out of scope: `ScorecardForm.tsx` still uses `COACHES` for the form dropdown — leave it; the user may need to score a class historically run by a now-inactive coach. (Confirm with user if they want the dropdown filtered too.)

## Files touched

- `src/components/scorecard/CoachScorecardGrid.tsx` — new (moved + extended from meeting/)
- `src/components/meeting/WigSection.tsx` — update import path
- `src/components/meeting/CoachScorecardGrid.tsx` — delete (or re-export from new path)
- `src/components/scorecard/WigFirstVisitSection.tsx` — swap line chart for grid, drop closed-mode toggle, drop Raw/Avg toggle
- `src/pages/Wig.tsx` — replace `COACHES` usage at lines 1002–1004 with active coaches; filter `ranByCoach` leaderboard by active coaches

## Verification

- WIG → First Visit Experience renders a 6-column week grid, one row per active coach, with averages by week. Toggle Self ↔ Formal recomputes. Tapping a cell opens the scorecard drilldown.
- Georgia no longer appears anywhere on the WIG tab (grid, leaderboard, per-coach tables, pickers).
- Meeting → WIG Session grid still renders (now from the new shared component), still uses "best score" semantics, Georgia gone there too.

## Confirm before building

1. **Cell value = average of all scorecards that week for the toggled eval type** — correct? Or do you want best-score (like Meeting view) or both side-by-side?
2. Drop the "Avg Score · Closed" chart-mode toggle entirely, since the grid replaces the line chart?
3. Leave `ScorecardForm` coach dropdown unchanged (still includes Georgia so historical entries can be filed) — OK?
