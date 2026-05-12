## WIG SA Leaderboard + Milestones cleanup

Three trims to the WIG → SA tab so the page shows just what matters and stops repeating itself.

### 1. SA Leaderboard table — drop everything except Milestones + Refs

`src/components/wig/WigSaLeaderboard.tsx`

- Remove columns: **Shifts**, **Coverage**, and the trailing chevron column.
- Keep columns: **SA**, **Milestones**, **Refs** (drop the `(0.00/sh)` rate suffix since shifts are gone).
- Remove the top "Shifts worked" tile from the 3-tile header row → 2-tile row (Milestones marked, POS referral asks).
- Remove the `shifts` drill bucket entirely (`DrillBucket`, drill rows for shifts, totals.shifts).
- Remove the streak `Flame` badge next to the SA name (streak is shift-derived; with shifts gone it's noise).
- Sort the table by `milestones desc, referralAsks desc` instead of refs/shift.
- Update header copy: "Tap a number to drill into the members. Tap an SA name to open their full page."
- Both number cells stay tappable buttons → open `PersonListDrillDown` already wired to member rows.

### 2. Kill the duplicate referral surfaces

`src/pages/Wig.tsx` (SA tab section)

- Delete the entire **"SA Lead Measures"** card (lines ~770-827) — POS Referral Ask is already in the leaderboard, Packs Gifted lives in the Milestones drill.
- Delete the **`<ReferralAskTracker dateRange={dateRange} />`** mount (line ~830) — actions live in MyDay, and the leaderboard already shows per-SA POS counts.
- Remove now-unused imports (`ReferralAskTracker`, anything only used by the deleted SA Lead Measures table such as `saLeadMeasures`, `measuresLoading`, `saDrill`, related drill dialog, `useLeadMeasures` if no other consumer).

### 3. Milestones section — collapse the always-on member list, keep add/edit

`src/components/dashboard/MilestonesDeploySection.tsx`

- Keep the summary tile row (Celebrated, Packs, Friends, Showed, Converted, In pipeline, etc.) — these already drill down to members.
- Keep the **Add Celebration** button + dialog exactly as is.
- Keep the **Edit Celebration** dialog + `openEdit` flow.
- Replace the always-rendered `Card` of every milestone row with a **search-only reveal**:
  - Search input stays at the top next to the Add button.
  - When `celSearch` is empty → render nothing (no list, no "No celebrations this week" message — the tiles already convey volume).
  - When `celSearch` has text → render the same filtered list rows with their existing Edit pencil + "They Came In" button + status badges.
- Result: drill-down from the tiles surfaces all members read-only; admin can still find any member by typing a name and edit them inline; nothing is removed functionally.

### Drill-down edit affordance (small add)

`PersonListDrillDown` rows currently support `href` but not an inline edit callback. To preserve "edit from drill-down" without a bigger refactor, the Milestones tile drill-downs already use `PersonListDrillDown`; users who want to edit can either (a) close the drill and search by name in the Celebrations search, or (b) we can add an optional `onRowClick` to `PersonRow`. **Recommendation: skip the new affordance for now** — the search-and-edit path already covers the "edit any member" requirement and matches "like we can now". If you'd rather have edit directly from the milestone drill, say so and I'll add an `onRowClick` to `PersonListDrillDown` and wire it to `openEdit` for milestone rows only.

### Files touched

- `src/components/wig/WigSaLeaderboard.tsx` — strip columns/tiles/sort
- `src/pages/Wig.tsx` — remove SA Lead Measures card + ReferralAskTracker mount + dead state
- `src/components/dashboard/MilestonesDeploySection.tsx` — gate member list behind search

### Coherence checks before done

- WIG SA tab: only one place shows POS referral asks per SA → the leaderboard.
- Milestone counts in summary tiles match drill-down member counts.
- Add Celebration → row appears (via search) → Edit pencil opens dialog → save updates without page reload.
- MyDay `ReferralAskActions` still functions (untouched).
- SA Detail page (`/sas/:name`) still shows shifts/coverage (we only removed them from WIG, not from the SA's own page).