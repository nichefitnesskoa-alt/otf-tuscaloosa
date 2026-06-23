## Goal
Add an "Export CSV" button at the top-right of the SA Leaderboard section on the WIG tab that exports self-sourced leads with a date range picker and drilldown view.

## What gets counted (canonical definition)
A "self-sourced lead" = a row in the `leads` table where `sourced_by_sa` is set to a real SA (not a phantom name like Self-booked / System / Unknown). This is the same definition already used by `useSourcedLeadsToText` and `isSelfSourcedLeadSource` in `src/lib/sa/sourcedLeadsToText.ts` and `src/lib/sa/leadsBooked.ts` — we will reuse those helpers (no new logic) so this surface always agrees with the existing Sourced Leads system.

Date filter: `leads.created_at` converted to America/Chicago day.

## UI

**Location:** Top-right of the SA Leaderboard card header on the WIG tab (`src/components/wig/WigSaLeaderboard.tsx`, around line 351).

**Button:** "Sourced Leads" with a download icon, 44px tap target, OTF Orange.

**Click → opens a drawer/dialog** with:

1. **Date range picker** at top (shadcn Calendar, range mode, defaults to current pay period). Presets: This Week, This Pay Period, This Month, All-time, Custom.
2. **Total tile**: big number = total self-sourced leads in range. Click toggles drilldown open.
3. **Drilldown** with view toggle (segmented control):
   - **Grouped by SA** (default): rows of `SA name | count`, expand to show that SA's leads.
   - **Flat list**: every lead — `Name | Phone | Source | SA | Created (CST) | Booked? | Stage`.
4. **Download CSV** button (top-right of dialog): exports the current view/filter to `/sourced-leads-{range}.csv`.

## CSV columns
`first_name, last_name, phone, email, source, sourced_by_sa, created_at_central, stage, booked_intro_id, text_archived_at, text_archived_reason`

## Files

**New**
- `src/components/wig/SourcedLeadsDialog.tsx` — dialog with date picker, total tile, toggle, drilldown, CSV download.
- `src/hooks/useSourcedLeadsInRange.ts` — fetches `leads` rows with `sourced_by_sa` not null AND not in `PHANTOM_BOOKED_BY`, filtered by `created_at` in the chosen CST range. Wraps React Query.
- `src/lib/sa/sourcedLeadsCsv.ts` — pure CSV builder (mirrors `src/features/giveaway/lib/csvExport.ts` style).

**Edited**
- `src/components/wig/WigSaLeaderboard.tsx` — add "Sourced Leads" button in the SA Leaderboard header (right side), wire to dialog.

## Canonical reuse (no new logic)
- Phantom-name filtering: `PHANTOM_BOOKED_BY` from `src/lib/sa/leadsBooked.ts`.
- "Self-sourced" predicate: `isSelfSourcedLeadSource` from same file (applied to `leads.source` so the count agrees with the booked-SGL definition).
- Central-time day boundaries: existing helpers in `src/lib/dateUtils.ts`.
- Pay-period range default: `src/lib/pay-period.ts`.

## Coherence check before done
Run real DB query for the chosen default range and confirm:
- Dialog total === SUM of per-SA counts in grouped view === row count in flat view === row count in CSV.
- Per-SA counts in dialog match the SA Leaderboard "Sourced" column for the same date range.
- User-stated expectation: ~72 for whatever range produces that number — we'll verify which range yields 72 once built and surface it as a preset if needed.

## Out of scope
- No changes to existing leaderboard counts, no schema changes, no new tables, no edits to other pages.