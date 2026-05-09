# Plan — Tappable person-tied metrics + canon regression tests

## 1. Regression tests for label + close detection

Add `src/lib/intros/__tests__/resultLabels.test.ts` covering every real DB canon value so future schema drift fails CI instead of silently mislabeling members like Alexa.

Cases (each asserts both `labelForRun` output and `isCloseResult`):

| result_canon | result string | label | close? |
|---|---|---|---|
| SALE | "Premier" | SALE | true |
| PREMIER | "Premier" | SALE | true |
| PREMIER_OTBEAT | "Premier + OTbeat" | SALE | true |
| ELITE | "Elite" | SALE | true |
| BASIC | "Basic" | SALE | true |
| SECOND_INTRO_SCHEDULED | "" | Booked 2nd | false |
| PLANNING_2ND_INTRO | "" | Booked 2nd | false |
| FOLLOW_UP_NEEDED | "" | Follow-Up | false |
| FOLLOW_UP | "" | Follow-Up | false |
| PLANNING_TO_BUY | "" | Planning to Buy | false |
| ON_5_CLASS_PACK | "5 class pack" | 5 Class Pack | false |
| NOT_INTERESTED | "" | Not Interested | false |
| NO_SHOW | "" | No Show | false |
| VIP_CLASS_INTRO | "" | VIP Intro | false |
| UNRESOLVED | "" | Unresolved | false |
| (null) | "Premier + OTbeat" | SALE | true (fallback path) |
| (null) | "" | — | false |

Also extend `close-detection.test.ts` with the new canon values so `isCloseRun` stays in lockstep.

## 2. Mobile-first shared drilldown

Refactor `CoachAttributionDrillDown.tsx` → `PersonListDrillDown.tsx` (keep existing as a thin wrapper to avoid touching `Wig.tsx` / `PerCoachTable.tsx` callers).

Changes:
- Use `Sheet` from `bottom` on mobile (`useIsMobile`), `Dialog` centered on desktop. Bottom sheet snaps to 90vh, drag handle, no input focus required.
- Trigger affordance: every tappable number gets `min-h-[44px] min-w-[44px]`, underlined OTF Orange numerals on hover/focus, `cursor-pointer`, `aria-label="View N people"`. Disabled (no underline, default cursor) when count is 0.
- Title accepts `{ scope, metric, count }` so non-coach contexts read naturally ("Premier members · 7", "Friends showed up · 3", "Booked from Instagram · 12").
- Rows accept generic `PersonRow { id; name; subtitle?; rightLabel?; rightTone?; href? }`. Tapping a row with `href` navigates (e.g. lead detail, pipeline row).
- Reuse existing reconciliation footer only when caller passes `attribution` (coach context).

## 3. Wire shared drilldown into the four remaining tables

Each table builds a `PersonRow[]` for each numeric cell from data already in scope (no new queries unless noted).

### PerSATable
- `Ran`: first-intro bookings attributed to that SA where the run is "ran" (excludes NO_SHOW, UNRESOLVED, VIP_CLASS_INTRO via `didIntroActuallyRun`).
- `Sales`: same set filtered by `isCloseResult` on direct or 2nd-intro Total Journey run.
- `Close%`: opens the same Sales list with reconciliation footer ("X of Y ran").
- Wire by lifting source rows from `Recaps.tsx` (where PerSAMetrics is built) into a `peopleByMetric` map and passing it into the table.

### BookerStatsTable
- `Booked`: bookings where `booked_by === sa`. Subtitle = class date.
- `Showed`: same, filtered to `booking_status_canon === 'SHOWED'`.
- `Show%`: opens the Showed list.
- Build map alongside `BookerMetrics` in `Recaps.tsx`.

### OutreachTable
- `FU`: rows from `followup_touches` for that SA in range — name = lead/member, subtitle = touch type + date.
- `DMs`: from `shift_task_completions.count_logged` rows; subtitle = shift date. (No name → show "DM batch · {n}" rows.)
- `Leads`: unique leads first-contacted; subtitle = lead source.
- `Speed`: opens the same Leads list ordered by minutes-to-first-contact, with the minutes value as `rightLabel`.
- Source data comes from `useLeadMeasures`; expand the hook to return `peopleByMetric` per SA.

### ReferralAskTracker
- `{pendingCount} to do`: tap → list of pending `Row`s.
- `{completedCount} asked`: tap → completed rows. Each row tappable → opens the lead/member in `/pipeline?leadId=…` (already wired via `navigateToLead` for milestones; mirror that for the booking).

## 4. Wire shared drilldown into MilestonesDeploySection, VipClassPerformanceTable, LeadSourceChart

### MilestonesDeploySection
Each summary card becomes a button. Person rows derived from `milestones` + `friendTracking` already in state:
- `Celebrated (X / Y)`: two stacked lists — celebrated rows (green tone) and not-yet-celebrated (amber). Subtitle = milestone type + created_at.
- `Packs gifted`: rows where `five_class_pack_gifted`. Subtitle = friend name if any.
- `Friends showed up`: rows in `friendTracking` where `friendShowedUp`. Tap row → navigate to friend's intro/lead.
- `Converted to member`: rows where `convertedToMember`. Tap → lead/booking detail.
- `Friends in pipeline`: rows with `converted_to_lead_id`. Tap → `/pipeline?leadId=…`.

### VipClassPerformanceTable
For each session row, the `Booked / Ran / Joins` numbers become tappable. Need a small extension to the existing query — keep the per-session intro rows in state instead of just counts. Person rows show member_name + result label (`labelForRun`).

### LeadSourceChart
`SourceRow` already calls `onBoxClick(category)` which today opens `FunnelDrillSheet`. Replace that sheet with `PersonListDrillDown` for visual consistency, fed by the existing `bookedPeople / showedPeople / soldPeople` arrays. Map `LeadSourcePerson` → `PersonRow` (name, class date subtitle, status badge). Keep `FunnelDrillSheet` only if other callers depend on it; otherwise delete.

## 5. Files

**New**
- `src/lib/intros/__tests__/resultLabels.test.ts`
- `src/components/dashboard/PersonListDrillDown.tsx` (the new shared component)

**Edited**
- `src/lib/intros/__tests__/close-detection.test.ts` (add canon cases)
- `src/components/dashboard/CoachAttributionDrillDown.tsx` (becomes thin wrapper)
- `src/components/dashboard/PerSATable.tsx`
- `src/components/dashboard/BookerStatsTable.tsx`
- `src/components/dashboard/OutreachTable.tsx`
- `src/components/dashboard/ReferralAskTracker.tsx`
- `src/components/dashboard/MilestonesDeploySection.tsx`
- `src/components/admin/VipClassPerformanceTable.tsx`
- `src/components/dashboard/LeadSourceChart.tsx`
- `src/pages/Recaps.tsx` (lift per-row people maps for the four Studio tables)
- `src/hooks/useLeadMeasures.ts` (expose per-metric people for Outreach)

## Out of scope
- Reconciling WIG vs Studio totals (separate audit).
- Commission/attribution rule changes.
- New DB columns or migrations.
