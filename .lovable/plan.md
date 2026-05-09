## Investigation findings

**Bug 1 + Bug 2 share one root cause.** Koa has 4 self-evals this month (Sophia, Madison, Mike, Joyce). Madison/Mike/Joyce closed; Sophia is `PLANNING_TO_BUY` (didn't close — a real ran intro).

In `useFvTrendData.ts` the run-loop does:

```ts
const coach = (r.coach_name || b?.coach_name || '').trim();
if (!coach || /^tbd$/i.test(coach)) return;
```

Sophia's `intros_run.coach_name = 'TBD'`. Because `'TBD'` is truthy, the `||` short-circuits before reaching the booking fallback (`Koa`), so the regex drops the row. Sophia never lands in `ran`, never lands in `selfOnly`, never lands in `notClosed`. Both tiles silently lose her.

**Bug 3.** `WigFirstVisitSection.tsx` lines 166–170: `unscored` is rendered as a static `<Badge>` inside the row's `<button>` whose only handler is `setExpandedCoach`. Whole row toggles the trend chart; the chip is decoration.

Close-detection (`closedCount`) already routes through canonical `resolveClosedFirstIntroIds`. `notClosedCount` is the inverse computed in the same loop, so once the TBD-fallback bug is fixed both tiles + coverage will be correct.

---

## Plan

### Phase 1 — Bug fix (single file)

**`src/hooks/useFvTrendData.ts`** — replace the coach resolution inside the `intros_run` loop with a real fallback:

```ts
const rawRun = (r.coach_name || '').trim();
const coachFromRun = rawRun && !/^tbd$/i.test(rawRun) ? rawRun : '';
const coachFromBooking = (b?.coach_name || '').trim();
const coach = coachFromRun || (coachFromBooking && !/^tbd$/i.test(coachFromBooking) ? coachFromBooking : '');
if (!coach) return;
```

That alone restores Sophia → Koa, which makes:
- `closingTiles.notClosedCount` = 1, `avgNotClosed` = 23.0
- coverage `selfOnly` = 3/4 (75%)
- `ranByCoach.Koa` = 5
- `unscoredByCoach.Koa` unchanged

No other math touched.

### Phase 2 — Unscored chip drill-down

**New `src/lib/intros/unscoredList.ts`** — small hook `useUnscoredIntrosByCoach(coach, range)` that returns `{ id, member_name, class_date, intro_time }[]` by intersecting `ranByCoach` bookings (already in scope) with the absence of any submitted scorecard for that `first_timer_id`. Single React Query keyed `['fv_unscored', coach, from, to]`.

**`WigFirstVisitSection.tsx`** — wrap the unscored badge in a real `<button>` with 44 px tap target, OTF Orange outline. On tap open `<UnscoredDrillDown>` modal (new local component):

- Title: `{coach} · {n} unscored`
- Each row: member name, `MMM d · h:mm a`, tap target 44 px
- Tap row → close drill-down, open `ScorecardForm` in a `Dialog` pre-filled with `evaluatee_name=coach`, `first_timer_id=bookingId`, `eval_type` = `self_eval` if `currentUser.name === coach` else `formal_eval`
- After submit, modal stays open (manage `formOpen` state separately); React Query invalidation removes the row automatically

`ScorecardForm` already accepts those props — confirm and reuse, do not fork.

### Phase 3 — Coach detail page

**New route** `/coaches/:coachName` (no conflict with `/coach-view`, `/coach`, etc).

**New `src/pages/CoachDetail.tsx`**:

- Header: coach name (h1), cadence streak badge, self-every-week badge
- `DateRangeFilter` (default `this_month`) — same component as WIG
- Tile row: ran intros, formal avg / count, self avg / count, gap, closing % (reuse `useFvTrendData` filtered to that coach)
- Full-width `TrendChart` (lift to `src/components/scorecard/TrendChart.tsx` so both WIG and detail share it)
- Unscored intros panel — reuses Phase 2 modal contents inline
- Recent scorecards list — reuses `BookingScorecards`-style row
- Cadence panel — current week obligation, streak count

Register in `src/App.tsx` next to `/scorecards/me`. Allowed roles: Admin always; Coach if `coachName === user.name`.

**`WigFirstVisitSection.tsx` leaderboard row split** — separate the row into two adjacent buttons sharing the visual surface:

```text
[ name + badges + metric line ] [ unscored chip ] [ chevron ]
        link → /coaches/X            modal           expand
```

Coach name styled as link (orange on hover, underline). Chevron stays the expand handle. Each remains 44 px.

**`CoachDashboard.tsx`** — add a "View full coach page" link routing to `/coaches/{coachName}`.

### Phase 4 — Streak + self-every-week badges

`cadenceStreakWeeks` and `isSelfEvalEveryWeekThisMonth` already exist in `trends.ts`. In leaderboard row:

- If `cadenceStreakWeeks(coach, scorecards) >= 2` → render `<Badge variant="outline" className="text-[10px] gap-1">🔥 {n} wk streak</Badge>`
- If `isSelfEvalEveryWeekThisMonth(coach, scorecards)` → render `<Badge variant="outline" className="text-[10px]">Self every week</Badge>`

Subtle outline pill, OTF Orange text on neutral surface (no aggressive fill). Both also render in `CoachDetail.tsx` header.

### Phase 5 — Closing-tile drill-down

In `WigFirstVisitSection.tsx` make each `ClosingTiles` card a button:

- Avg · closed → modal listing every primary scorecard whose `first_timer_id` is in the closed set, tap row → `ComparisonView` (already wired)
- Avg · didn't close → same, inverse set
- Each `CovRow` inside "Closing % by coverage" → button opening modal listing intros in that coverage bucket (formal / selfOnly / unscored)

To wire this without re-querying, expand `useFvTrendData`'s return to include three flat arrays: `closedCards`, `notClosedCards`, `coverageBuckets: { formal, selfOnly, unscored }` — populated in the same `ran.forEach` loop already there. Pure additions, no logic changes.

### Downstream cleanup

- Confirm every metric on the page sources closes from `resolveClosedFirstIntroIds` (already true after Phase 1)
- No second close-detection implementation introduced
- Verify chevron expand still works after row split (Phase 3)
- Streak badge hidden when `< 2` (already enforced in Phase 4 condition)
- Flag for separate task: audit other static count chips (My Day "X follow-ups", Pipeline "X new leads") — drill-down candidates, no code here

### Files touched

- `src/hooks/useFvTrendData.ts` (bug fix + tile/coverage card arrays)
- `src/components/scorecard/WigFirstVisitSection.tsx` (chip → button, row split, badges, tile drill-down)
- `src/components/scorecard/TrendChart.tsx` *(new — extracted)*
- `src/components/scorecard/UnscoredDrillDown.tsx` *(new)*
- `src/components/scorecard/CoachStreakBadges.tsx` *(new)*
- `src/lib/intros/unscoredList.ts` *(new — hook)*
- `src/pages/CoachDetail.tsx` *(new)*
- `src/App.tsx` (register `/coaches/:coachName`)
- `src/components/scorecard/CoachDashboard.tsx` (link to detail page)

### Acceptance checks before close

1. Koa, this month: `closedCount=3, avgClosed=22.7, notClosedCount=1, avgNotClosed=23.0`, selfOnly coverage `75% (3/4)`, unscored unchanged
2. Tap "1 unscored" on Koa row → modal lists Sophia (or whichever pre-system intro), tap → form opens in self-eval mode
3. Tap "Koa" name → routes to `/coaches/Koa`, chevron still expands inline
4. Streak badge appears only when ≥ 2 weeks
5. `/coaches/:coachName` does not collide with existing routes (verified — only `/coach-view` exists)
