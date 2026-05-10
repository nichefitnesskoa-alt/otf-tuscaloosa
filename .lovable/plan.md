**GAPS LOVABLE MISSED**

**1. Pre-May follow-up cleanup needs an audit trail, not a delete.** Plan says set status=resolved and resolved_by='System (Pre-May cleanup)'. Good. Add: write a migration log row per record so you can reverse it if you find one you didn't mean to archive. Never lose data you can't get back.

**2. The chart's "tap a point to open scorecards behind it" feature needs to survive the rebuild.** Plan doesn't mention preserving the drill-down. If per-day points now show per-coach lines, tapping a point on Koa's line should open only Koa's scorecards for that day. Specify it or it breaks.

**3. Legend color logic for per-coach lines.** Recharts will auto-assign colors. They'll change order if a coach gets added or removed. Lock a color map: each active coach gets a stable hex assigned in a constants file. Otherwise James is orange one week and red the next.

**4. Coach Stats totals row math.** Weighted close% (totalCloses / totalCoached) is correct. Make sure it's not a simple average of the column. Plan says weighted. Verify the implementation matches the plan.

**5. Role gating audit.** Flipping WIG to "everyone sees everything" for SAs and Coaches means every other place that filters by current_user needs review. Plan covers WIG aggregate sections. Add: search the codebase for every `.eq('owner_id', user.id)` or equivalent across the entire app and confirm none of them are silently filtering WIG-adjacent components. Same root cause rule.  
  
**RECOMMENDED WAVE ORDER FOR LOVABLE**

Tell Lovable to ship in this order, not all at once:

1. Pre-May follow-up cleanup migration (with audit log)
2. Chart math fixes: left-to-right sort, exclude unscored, fix Formal/Self toggle, fix This Month default
3. Coach Stats rename + totals row
4. Per-coach lines + Closed/Didn't close tabs (with locked color map and drill-down preserved)
5. Move My Scorecards into WIG + Koa coach picker
6. Rename My Intros to Text My Intros
7. Role gating flip: SA + Coach see all of WIG, Coaches get Studio tab

Steps 1-4 are data correctness. Steps 5-7 are visibility and labels. Correctness first.

## 1. Coach Stats section (WIG → Coach tab)

File: `src/components/dashboard/PerCoachTable.tsx` (or its WIG wrapper)

- Rename header "Coach — Coached & Closes" → **"Coach Stats"**
- Add a totals row at the bottom: sum of Coached, sum of Closes, weighted Close% (totalCloses / totalCoached).
- Style row with top border + bold so it reads as a totals row.

## 2. First Visit Experience graph (Studio overall)

File: `src/components/scorecard/CoachDashboard.tsx` and chart child(ren) under `src/components/scorecard/`.

Fixes:

- **Left-to-right ordering**: sort points by date ascending before passing to recharts (current data appears unsorted on "This Month").
- **Default date range bug**: investigate why "This Month" only plots one date — likely a grouping/dedupe step that collapses by week or filters out points with the same date key. Switch to per-day points sorted ASC with no week-bucketing.
- **Exclude unscored from line**: filter out scorecards where score is null/0/unscored before charting; do not coerce to 0 or 100. Keep them in the "X intros still waiting on a scorecard" callout only.
- **Formal vs Self primary toggle actually works**: today both toggles render same dataset. Wire `primary` state to actually swap which series is the bold/primary line and which is dimmed. Confirm dataset filter changes when toggled.
- **Per-coach lines**: in addition to "Studio overall", render one line per coach (color per coach, legend with toggles). Add a tab/segmented control above the chart:
  - `Studio` (overall avg line)
  - `By coach` (one line per coach, click legend to isolate)
- **Closed vs Didn't close lines**: add another tab/segment:
  - `All`
  - `Closed only`
  - `Didn't close only`
  - `Compare` (two lines: avg of closed vs avg of didn't close per date)
- All chart toggles share the same date range selector.

## 3. Role visibility on WIG

- **SA + Coach** logins: WIG tab shows everything (all coaches, all SAs, all studio metrics) — not just their own row. Remove any `filter by current user` on WIG aggregate sections.
- **Coaches** also get access to the **Studio tab** in bottom nav (currently Admin-only). Update `src/components/BottomNav.tsx` role gating.

## 4. My Scorecards lives inside WIG (not its own page)

- Move `My Scorecards` content into a sub-section/tab inside the WIG → Coach view, visible only to the logged-in person and showing only their own scorecards.
- **Koa (Admin)** gets a coach picker in that WIG sub-section to toggle between any coach's scorecards.
- Remove/redirect the standalone `/coach-scorecards` route from primary nav for non-admins (keep route for deep-links but surface entry point inside WIG).
- Files: `src/pages/CoachScorecards.tsx`, `src/components/scorecard/CoachDashboard.tsx`, WIG page (`src/pages/Wig.tsx`), `src/components/BottomNav.tsx`.

## 5. Rename "My Intros" → "Text My Intros"

- `src/components/BottomNav.tsx` (label)
- Page title in `src/pages/CoachMyIntros.tsx`
- Any other references (ripgrep `My Intros`)

## 6. Follow-up clean slate (pre-May 2026)

- Migration: mark all `follow_up_queue` rows where created_at < 2026-05-01 (America/Chicago) as resolved/archived so they drop off active queues.
  - Likely set `status = 'resolved'` (or whatever canonical "done" status this table uses) + `resolved_at = now()` + `resolved_by = 'System (Pre-May cleanup)'`.
  - Will confirm exact column names by reading the table schema before writing the migration.
- Verify all four follow-up tabs (Follow Up Needed, No Show, Plans to Reschedule, 2nd Intro) read empty for pre-May items afterward.

## CONFIRM THESE VALUES before implementing

1. Follow-up "clean slate" cutoff: **everything created before May 1, 2026 (CST)** — correct?
2. For the chart "Closed vs Didn't close" — should "didn't close" mean any first intro whose journey did not end in a sale (excluding still-pending)? Or strictly `result_canon != SALE` even if pending?
3. For per-coach lines on the chart — show all coaches by default, or default to studio overall and reveal per-coach via tab? (Plan assumes tab toggle.)

## Files to touch

- `src/components/dashboard/PerCoachTable.tsx`
- `src/components/scorecard/CoachDashboard.tsx` (+ chart children)
- `src/pages/Wig.tsx`
- `src/pages/CoachScorecards.tsx`
- `src/pages/CoachMyIntros.tsx`
- `src/components/BottomNav.tsx`
- New migration under `supabase/migrations/` for follow-up cleanup