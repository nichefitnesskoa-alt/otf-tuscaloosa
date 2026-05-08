Edit 1: Cadence chip kind rename safety

Before renaming the 'formal_eval' union to 'cadence_eval', do a full codebase grep for every reference to 'formal_eval' as a chip kind. Update every render site, every conditional, every type guard. Report the full list before merging. The current plan says “and update render site” singular — confirm there’s only one.

Edit 2: Cadence panel ideal-state language

The cadence panel on CoachDashboard should also surface when a coach is exceeding the minimum. Right now it shows what’s owed and the streak. Add one line beneath: when a coach has self-evaluated every week in the current month regardless of cycle, show “You’re self-evaluating every week. That’s the standard.”

&nbsp;

# First Visit Experience — Trends, Closing Score, Weekly Cadence

## Investigation findings

### 1. Date range component (already studio-grade — reuse, do not rebuild)

- **File:** `src/components/dashboard/DateRangeFilter.tsx`
- **Used by:** `src/pages/Wig.tsx`, `src/features/myDay/MyDayTopPanel.tsx`, `src/pages/Recaps.tsx`, `src/pages/Admin.tsx`, `src/components/admin/ObjectionReport.tsx`
- **Presets supported (in `src/lib/pay-period.ts` via `DatePreset` + `getDateRangeForPreset`):** `all_time`, `today`, `this_week`, `last_week`, `this_month`, `last_month`, `this_quarter`, `last_quarter`, `pay_period`, `last_pay_period`, `this_year`, `last_year`, `custom`. **Every preset we need is already there — no extension required.**
- **Custom range:** dialog with two `Calendar` pickers, applied via `onCustomRangeChange` + `onPresetChange('custom')`.
- **Pay periods:** biweekly (14 days), anchored `Jan 26 2026`, all derived in CT via `getNowCentral()`.

### 2. Scorecard schema (in place, no migration needed for trends)

- `fv_scorecards` — has `class_date`, `evaluatee_name`, `eval_type` ('self_eval' | 'formal_eval'), `total_score` (0–30), `level` (1/2/3), `submitted_at`, `first_timer_id` (FK to `intros_booked.id`).
- `fv_scorecard_bullets`, `fv_scorecard_comments` — present, fine for drill-down.
- **No-show field:** lives on `intros_run.result_canon`. The canon "did intro actually run" rule (per memory `mem://logic/intro-ran-detection`) excludes `NO_SHOW`, `UNRESOLVED`, `VIP_CLASS_INTRO` (and PLANNING_RESCHEDULE). `WigFirstVisitSection.tsx` already filters this way — we'll reuse the same predicate.
- "Closed" detection: same Total-Journey rule WIG already uses (membership sale on the chain originating from the first intro).

### 3. Existing 6/month + 2-formal-floor logic — much smaller than expected

- `**src/components/scorecard/CoachDashboard.tsx` line 11:** `const L3_TARGET = 6;` — the only "6" target. Drawn as `{l3Count}/6` with a progress bar. **No 2-formal-floor anywhere in code.** No DB column, no setting, no enforcement.
- `**src/features/myDay/useTodaysActions.ts`:** the `ActionChip.kind` union includes `'formal_eval'` but **no code path ever emits one**. The only scorecard chip emitted is `'score'` ("Score X's intro" for any of the coach's runs from yesterday/today missing a scorecard).
- `**WigFirstVisitSection.tsx`:** shows L1/L2/L3 counts + per-coach Self/Formal averages + Gap. No cadence enforcement.
- **No other references** to monthly minimums, formal floor, or cadence streaks anywhere.
- **Net:** removing the 6/2 system = delete the `L3_TARGET` block in `CoachDashboard.tsx` and replace with the new weekly cadence panel. Nothing else cleans up.

### CONFIRM THESE VALUES before build

1. **Cadence cycle anchor.** The brief asks. Two options:
  - **(A)** Studio-wide fixed odd/even ISO-week alternation in CT (odd ISO-week = self-eval week, even = formal). Simple, predictable, identical for every coach.
  - **(B)** Per-coach rolling: their last submitted eval's type flips for next week. More personalized but messy when a coach skips.
   Recommendation: **(A) studio-wide odd/even ISO weeks**, Monday CT reset.
2. **Moving-average window.** Brief suggests 4 weeks. Confirm 4-week window (auto-shrinks when range < 4 weeks of data → falls back to range average).
3. **Closing-score "score of the intro"** when both evals exist: default **Formal Primary** (matches brief), togglable to Self-Eval Primary on the tile.
4. **Unscored bucket scope:** count is "first intros that ran (per `didIntroActuallyRun`) in range with **zero** scorecards of any type tied to that booking." Confirm.

---

## Build plan (after confirmations)

### A. New shared building blocks

- `src/lib/scorecard/trends.ts` — pure functions:
  - `pickPrimaryScore(cards, mode: 'formal' | 'self')` → one card per `first_timer_id`.
  - `bucketByTime(points, range)` → auto bucket (daily / weekly / monthly).
  - `movingAverage(series, window=4)`.
  - `getCadenceWeek(date)` → `{ isoWeek, type: 'self' | 'formal' }` (CT-anchored, odd/even ISO weeks).
  - `getCadenceStatus(coach, scorecards, weekStart)` → `{ owed, met, streakWeeks }`.
- `src/hooks/useFvTrendData.ts` — single React Query hook that fetches `fv_scorecards` + the ran first-intro bookings (with their `intros_run` join) for the date range, returns:
  - `studioPoints`, `perCoachPoints` (Map),
  - `closingTiles` (avg-closed, avg-not-closed, coverage %s),
  - `unscoredCount` (studio + per-coach).
  - All filtered through `didIntroActuallyRun` (no-show exclusion).

### B. WIG — First Visit Experience section

File: `src/components/scorecard/WigFirstVisitSection.tsx` (rewrite)

1. Local state for date range (default `this_month`), Raw vs Moving Avg toggle, Formal/Self primary toggle. Top-mount the existing `<DateRangeFilter />`.
2. **Studio overall trend graph** (Recharts `LineChart`): two lines (faint amber self-avg, bold orange formal-avg), Y 0–30, x-axis bucketed. Toggle swaps to 4-wk MA. Tap point opens drill-down modal listing every scorecard in that bucket → opens `<ComparisonView />` on selection.
3. **Closing score tiles** (3 side-by-side, mobile stacks):
  - Tile 1 (orange): avg score of intros that closed.
  - Tile 2 (gray): avg score of intros that didn't close.
  - Tile 3: coverage rows — Formal-eval / Self-eval only / Unscored, each `X% closed (Y of Z)`.
  - Toggle: Formal Primary / Self-Eval Primary.
4. **Unscored callout:** small chip "X intros still waiting on a scorecard" beneath studio chart.
5. **Coach leaderboard** (replaces current per-coach table):
  - Row: coach, ran-count, formal avg, self avg, gap, **cadence dot** (green met / amber pending / red missed), unscored count, chevron.
  - Tap row → expands inline with that coach's trend chart, studio overall as faded gray line behind a bold orange coach line. Same Raw/MA toggle, same date range.
  - Tap point in expanded chart → same drill-down modal.

### C. CoachDashboard rewrite

File: `src/components/scorecard/CoachDashboard.tsx`

- Remove `L3_TARGET = 6` block.
- Add **Cadence panel** at top:
  - "This week you owe: **Self-eval**" (or Formal eval), with picker.
  - Streak badge: "X-week streak."
  - Month rollup: total / self / formal counts.
- Keep recent-cards list and mini trend (now wired through new helpers).

### D. MyDay weekly action chip

File: `src/features/myDay/useTodaysActions.ts`

- Add cadence chip for Coaches:
  - Compute current week obligation from `getCadenceWeek(today)`.
  - Check `fv_scorecards` for an evaluatee=coach, eval_type matching, submitted within current Mon–Sun CT.
  - If unmet, push chip: label `"Self-eval owed this week"` or `"Formal eval owed this week"` with `kind: 'formal_eval'` reused (rename union to `'cadence_eval'` and update render site).
  - Chip persists past week end if missed (no expiry filter).
- Render site: search for ActionChip rendering (`TodaysActions.tsx` / `WinTheDay.tsx`) and add the new kind icon/route (opens picker → `ScorecardForm`).

### E. Reports tab refresh

File: `src/pages/Reports.tsx`

- Replace any 6/2 references (none found, but verify on build) with: scored-coverage breakdown (Formal / Self / Unscored), cadence-streak column per coach.

### F. Verification

- Type check (auto).
- Re-render WIG with `this_month` default and confirm: chart renders, tiles populate, leaderboard expand works on 440px viewport (current preview width).
- Confirm chip appears on MyDay for a coach in the current ISO-week obligation window.

### Files touched (final list will be reported on completion)

- `src/components/scorecard/WigFirstVisitSection.tsx` (rewrite)
- `src/components/scorecard/CoachDashboard.tsx` (cadence + remove 6/2)
- `src/lib/scorecard/trends.ts` (new)
- `src/hooks/useFvTrendData.ts` (new)
- `src/features/myDay/useTodaysActions.ts` (cadence chip)
- `src/features/myDay/TodaysActions.tsx` or `WinTheDay.tsx` (render new chip kind)
- `src/pages/Reports.tsx` (coverage + streak surfacing if section exists)
- `src/pages/Wig.tsx` (only if FV section needs to receive the shared `dateRange` from WIG header — currently it owns its own; leave separate per non-negotiables)

No DB migrations required. No changes to `DateRangeFilter.tsx` or `pay-period.ts`.