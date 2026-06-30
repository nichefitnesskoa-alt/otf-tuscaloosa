## Goal

1. Studio page should count VIP-sourced intros AND VIP-day sales (on-the-spot purchases) — no more "Excludes VIP events".
2. VIPs page: each of the 4 metric tiles (Classes, Attendees, Intros Booked, Joins) becomes tappable, opening a drilldown grouped by VIP session with expandable individuals.

---

## Part 1 — Studio page: include VIP

Today `isVipBooking` / `isVipRun` (`src/lib/vip/vipRules.ts`) gates out anything with `is_vip`, `booking_type_canon=VIP/COMP`, `vip_session_id`, or `lead_source` containing "vip". The Studio Scoreboard and Conversion Funnel filter these out, and the "Excludes VIP events" copy is shown.

Changes:

- `src/components/dashboard/StudioScoreboard.tsx` and `src/components/dashboard/ConversionFunnel.tsx`: stop filtering out VIP bookings/runs. Include any VIP intro that ran, and any sale tied to a VIP booking (whether on-the-spot via `intros_run` SALE on a VIP booking, or a later real intro that closed).
  - Keep the existing `getRanFirstIntroBookings` / `didIntroActuallyRun` / `isCloseRun` helpers as the source of truth — only remove the VIP exclusion branch.
  - Remove "Excludes VIP events" copy on `StudioScoreboard`.
- `Studio Scoreboard` Intros Run / Sales / Close Rate now reflect VIP attendees who actually showed AND any sale logged against a VIP booking.
- `Conversion Funnel` 1st/2nd/Total/Total Journey: VIP-classified bookings are now eligible. A VIP-only attendee with no later real intro who buys on the spot counts as 1st intro Booked + Showed + Sold (via the run linked to their VIP booking).
- Drilldowns inherit automatically because they share the same selector logic.
- Per-Coach / Per-SA tables: same change — drop the VIP exclusion so VIP-day sales credit the coach who ran the VIP class and the SA who set it up.

Verification (DB):
- Confirm `intros_run` rows linked to VIP `intros_booked` with `isCloseRun=true` show up in Studio "Sales".
- Confirm Studio Scoreboard "Intros Run" = `didIntroActuallyRun` count across STANDARD + VIP for the active range.
- Cross-page: Studio Sales count for date range matches WIG sales count for the same range.

## Part 2 — VIPs page drilldowns

`VipPerformanceDashboard.tsx` currently shows 4 read-only tiles. Make each tile a button that opens a shared `VipMetricDrilldownDialog` (new file under `src/features/vips/`).

Drilldown structure (all four metrics):
- Header: metric name + total + date range (current quarter, with same date filter pattern used elsewhere — Pay Period / This Month / Custom).
- Section A — **By Group (VIP session)**: list of sessions sorted by date desc with: group name, date, count for this metric. Click to expand → individuals.
- Section B — **Individuals** (inside expanded group): name, phone, outcome/badge relevant to the metric, "Open in Pipeline" deep-link (reuses existing `?focus=` behavior).
- Toolbar: tab toggle "By Group | By Individual (flat)" so Koa can also see a flat sortable list.

Per-metric population (single helper `useVipMetricBreakdown(metric, dateRange)`):
- **VIP Classes** → list of sessions themselves; "individuals" = registrants attached to that session.
- **Total Attendees** → registrations with `outcome ∈ {showed, booked_intro, purchased}`, fallback to legacy `actual_attendance` summary row when no per-person outcomes exist (flagged "Legacy count, no individual breakdown").
- **Intros Booked from VIP** → union of registrations with `outcome ∈ {booked_intro, purchased}` and `intros_booked` rows with `vip_session_id` set, deduped by `(session_id, normalized name)`.
- **Joins from VIP** → registrations with `outcome=purchased` + `intros_run` SALE on VIP bookings (matches the existing `joinKeys` logic in `VipPerformanceDashboard`).

Tiles render with new `<button>` styling (44px tap target, hover ring, cursor-pointer) per workspace UI rules.

## Technical notes

- Single source of truth: extract the metric-set builders out of `VipPerformanceDashboard.tsx` into `src/features/vips/vipMetrics.ts`. Both the tile counts and the drilldown read from the same builder so totals always match the drilldown row counts.
- Date filter: lift the quarter constants into `vipMetrics.ts` and accept a `DateRange` argument so the future date picker just passes through.
- Cross-page consistency: after removing VIP exclusion, audit consumers of `isVipBooking`/`isVipRun`:
  - Studio Scoreboard, Conversion Funnel, Per-Coach, Per-SA → drop exclusion.
  - MyDay/Follow-Up/Questionnaire hub → keep `shouldExcludeVipFromFunnel` exactly as-is (those are operational queues, not reporting).
  - WIG sales/close → already counts VIP sales today; no change.
- No new tables. No migrations.

## Files touched

- `src/lib/vip/vipRules.ts` — keep predicates, narrow what calls `shouldExcludeVipFromFunnel`.
- `src/components/dashboard/StudioScoreboard.tsx` — remove VIP filter, drop "Excludes VIP events".
- `src/components/dashboard/ConversionFunnel.tsx` — remove VIP filter from booking/run sets.
- `src/components/dashboard/PerCoachTable.tsx`, `PerSATable.tsx` — remove VIP filter.
- `src/features/vips/vipMetrics.ts` (new) — shared metric builders.
- `src/features/vips/VipPerformanceDashboard.tsx` — tiles become buttons; reads from `vipMetrics`.
- `src/features/vips/VipMetricDrilldownDialog.tsx` (new) — shared drilldown UI.

## Coherence proof at end

Will verify with `psql`:
- Pick a known VIP on-the-spot sale (e.g. confirm one exists in `intros_run` linked to a VIP `intros_booked`).
- Show Studio Scoreboard count before/after equals expected delta.
- Show each VIP tile total equals sum of group rows in its drilldown, which equals sum of individuals expanded.
- Confirm WIG sales for same date range matches Studio sales.
