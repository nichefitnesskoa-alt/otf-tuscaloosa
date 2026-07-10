## Goal
Everywhere a lead source has an associated dropdown value (referrer name, business partner, event, general outreach activity), show that detail inline next to the lead source — at-a-glance on cards, drill-downs, and drawers.

## Canonical helper (new)
`src/lib/leadSource/formatLeadSourceDetail.ts`
- Input: `{ lead_source, referred_by_member_name, event_id }` + `events` lookup (name + activity_type + event_date)
- Output: `{ label, detail }` where:
  - Referral variants (`Client Referral`, `Buddy Card Referral`, `Milestone Referral`, `Coach Referral`, `Business Partnership Referral`, `VIP Class (Friend)`, `Event / Self Generated Lead (Friend)`, any `(Friend)` source) → detail = `referred_by_member_name`
  - `Business Partnership Referral` → detail = partner name (stored in `referred_by_member_name`)
  - `Event / Self Generated Lead` + `(Friend)` → detail = `Event Name` or `Event Name (M/D)` if event_date present; prefix "Event" or "Outreach" based on `activity_type`
  - Renders as `Lead Source · Detail` (e.g. `Business Partnership Referral · Turbo Coffee`, `Event · Bama Bash (10/12)`, `General Outreach · Farmer's Market`)
- Fallback: source only, no detail

## Shared events lookup
`useEventLookupMap()` hook (thin wrapper on existing `useEvents`) returning `Map<id, { name, activity_type, event_date }>` — used by all consumers to avoid extra fetches. Pre-fetched on mount per project rule.

## Consumers to update (single-line badge under name / next to source chip)
1. `src/components/myday/MyDayIntroCard.tsx` — replace bare `booking.lead_source` render with helper output
2. `src/features/pipeline/components/PipelineRowCard.tsx` — journey rows currently show `| {b.lead_source}`; append detail
3. `src/components/dashboard/FollowUpsDueToday.tsx`
4. `src/components/dashboard/UnresolvedIntros.tsx`
5. `src/components/dashboard/TodayActivityLog.tsx`
6. `src/components/dashboard/ClientProfileSheet.tsx` (drill-down)
7. `src/components/dashboard/InlineIntroLogger.tsx`
8. `src/components/dashboard/PrepDrawer.tsx`
9. `src/components/myday/OutcomeDrawer.tsx` (context header)
10. `src/components/myday/EditBookingDialog.tsx` (read-only summary line, editing still uses `LeadSourceWithReferrerField`)
11. `src/features/pipeline/components/VipPipelineTable.tsx` — where lead_source is shown
12. `src/components/dashboard/PerSATable.tsx` / `PerCoachTable.tsx` / `BookerStatsTable.tsx` — only if source is currently rendered (tables that count don't need it)

## Data query updates
Ensure any of the above pulling `intros_booked` also selects `referred_by_member_name` and `event_id`. Add missing columns to the shared prep/booking query hooks so cards can render without extra round-trips (pre-fetch rule).

## Styling
- Use existing muted-foreground text; detail after a middot `·` on same line
- Truncate long values with `title=` tooltip
- No new colors, no new components

## Coherence proof
Verify in DB that a booking with `lead_source='Business Partnership Referral'` shows `referred_by_member_name` inline on: MyDay card, Pipeline row, Follow-Up Due Today, Activity Log, Client Profile drill-down. Same for one Event and one Event/(Friend). Cross-page: same text string appears everywhere for the same booking id.
