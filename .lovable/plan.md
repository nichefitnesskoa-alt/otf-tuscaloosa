Three fixes, scoped to presentation + one shared setting.

## 1. Edit milestones directly from the drilldown

Today the drilldown rows in `MilestonesDeploySection` are read-only — the only way to edit is the name-search field. Make every row tappable to open the existing `editOpen` dialog (`openEdit(item)` already exists).

Changes:

- `src/components/dashboard/PersonListDrillDown.tsx` — add optional `onClick?: () => void` to `PersonRow`. When set, render the row as a button-styled element with hover/active affordance (same treatment as `href` rows).
- `src/components/dashboard/MilestonesDeploySection.tsx` — in the `drillRows` builder, attach `onClick: () => { setDrill(null); openEdit(m); }` to each row. Skip onClick for the `inPipeline` bucket (keep its `href` navigation as-is).

Result: tap any face in Celebrated / Packs / Showed up / Converted → edit dialog opens pre-filled. Search bar still works for finding members not in the current filter.

## 2. Own It "your two numbers" follows the meeting week stepper

Root cause: `SaWeeklyGoals` always computes `currentMondayYMD()` from "now", ignoring `weekDate` from the parent `TheTable` page. Stepping Prev/Next week doesn't change its numbers.

Changes:

- `src/components/table/SaWeeklyGoals.tsx` — accept a `weekStart: string` (YYYY-MM-DD Monday) prop. Drop the internal `currentMondayYMD()` derivation. Use the prop for `weekStart`/`weekEnd` passed to `useSaLeadsBooked` / `useSaSales`, and for the "Week of M/D" label. Keep the same parsing helpers.
- `src/pages/TheTable.tsx` — pass `weekStart={weekDate}` (the existing state already used by the Prev/Today/Next buttons) when rendering `<SaWeeklyGoals />`.

Result: stepping the week changes "Your two numbers this week" and the "Week of …" label. May 11 ≠ May 18 ≠ May 25.

## 3. SA leads target is monthly, not weekly

Today the studio_setting `sa_leads_booked_target:YYYY-MM` is stored as a per-week number (default 4) and the leaderboard scales it by `weeks × activeSAs`. Switch it to mean "per SA per month."

Changes:

- `src/components/wig/WigSaLeaderboard.tsx`:
  - Rename intent: `leadsTarget` now = monthly per-SA leads goal. Default = `DEFAULT_SA_LEADS_TARGET = 16` (was 4 weekly ≈ 16 monthly). Sales target stays weekly (unchanged — user asked only about leads).
  - In the period-goal memo: compute `monthDays` = days in the month of `dateRange.start` (CST). `leadsPeriodGoal = round(leadsTarget × days / monthDays)`. `leadsProRata = leadsTarget × elapsedDays / monthDays`. Sales path unchanged.
  - Editor label: change "Leads/SA/week" → "Leads/SA/month".
  - Tile copy on the team rollup: "monthly goal" instead of "weekly goal" for the leads tile only.
- `src/components/table/SaWeeklyGoals.tsx`:
  - Read the same monthly target. For the displayed week, show `{thisWeekCount} of {Math.round(monthlyTarget / 4)}` for leads (weekly slice of monthly goal). Sales stays `{count} of {weeklyTarget}`.
  - Subtitle still reads "Your two numbers this week · Week of M/D".

Backfill: existing rows in `studio_settings` for `sa_leads_booked_target:YYYY-MM` were authored as weekly numbers. **One-time migration:** multiply existing values by 4 so the meaning lines up with the new monthly interpretation. (e.g. an existing 4 becomes 16.) Sales settings untouched.

## Coherence proof I will produce before closing

- DB: read current `sa_leads_booked_target:2026-05` and `:2026-06` rows, run the ×4 update, re-read.
- WIG SA leaderboard for May 1–May 31: pick one SA (e.g. Kaiya). Confirm `leadsPeriodGoal = 16` and the row reads `"<count> of 16"`.
- Own It for Week of May 25 (the screenshot week): confirm Kaiya's leads = same number as her May-25-to-May-31 slice in WIG drilldown, and target shows `4` (= 16/4) on the leads tile. Sales tile unchanged at `of 1`.
- Own It stepper: confirm May 11 vs May 18 vs May 25 produce three different `leads booked` numbers (or three identical zeroes only if she truly booked nothing those weeks — verified by DB).
- Milestones drilldown: open Celebrated, tap a row, confirm edit dialog opens with the right member pre-filled and saving updates the count + closes the dialog.

## One thing to confirm

For the **Own It leads tile** while the leads target is monthly, do you want it to show:

- **(A)** the weekly slice — `8 of 4` (count for the selected week, target = monthly/4). Matches the current "your two numbers this week" framing.
- **(B)** month-to-date — `12 of 16` (cumulative through the selected week's end, target = full month). Reads as monthly progress.

I'll default to **A** unless you say otherwise — it preserves the per-week stepper meaning. Say "B" if you'd rather see month-to-date there.  
  
Let's go with 