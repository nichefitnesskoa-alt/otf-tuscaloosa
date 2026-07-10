## Goal

Rename the "Event" lead source to "Event / Self Generated Lead", add an outreach-type picker (dated event vs. general outreach), let staff pick or type-to-create either kind, and add a "(Friend)" variant that counts as both self-generated and a referral.

## What changes for the user

When you pick **Event / Self Generated Lead** as a lead source on any booking/log form, you'll get a toggle:

- **Event (has a date)** — same behavior as today. Pick an existing event or create a new one with a name + date. Cost gets added later.
- **General outreach** — pick from a dropdown of previously-logged outreach activities (e.g. "Cold gym floor asks", "Neighborhood door knocking") or type a new one and save. No date required.

Both count as **Self Generated Leads** on the SA leaderboard (not referrals).

A new source **Event / Self Generated Lead (Friend)** appears too — same picker, but this one counts as **both** an SGL *and* a referral (asks for the referring member/friend name, routes into the SOML referral pipeline).

## Technical details

### 1. Lead source list (`src/types/index.ts`)
- Rename `'Event'` → `'Event / Self Generated Lead'`.
- Add `'Event / Self Generated Lead (Friend)'`.
- Existing `endsWith('(Friend)')` check in `isReferralLikeSource` picks up the friend variant automatically → SGL + referral, no other changes needed.
- Existing EXCLUDED_LEAD_SOURCES doesn't include it → both variants keep counting as SGL.

### 2. `events` table → outreach activities
Migration:
- Add `activity_type text not null default 'event'` with check constraint (`'event'`, `'general_outreach'`).
- Make `event_date` nullable (required only when `activity_type = 'event'`, enforced by a trigger — not a CHECK, per project rules).
- Backfill: existing rows stay `activity_type = 'event'`.
- Data migration: `UPDATE intros_booked SET lead_source = 'Event / Self Generated Lead' WHERE lead_source = 'Event'` (and same on `leads.source`, `sales_outside_intro`, `follow_up_queue`, `outcome_events`, etc. — every table that stores the source string).

### 3. `EventPicker` → `OutreachActivityPicker`
- New top-level toggle (2 buttons): "Event (has date)" vs. "General outreach".
- Event mode: current UI (name + date, existing list filtered to `activity_type = 'event'`).
- General outreach mode: combobox list filtered to `activity_type = 'general_outreach'` + inline "Create new" (name only).
- Emits selected `event_id` to parent (same contract as today; parent already stores it on the booking).
- `useActiveEvents` / `useCreateEvent` accept an optional `activityType` filter/arg.

### 4. Canonical helper
Add `isEventOrOutreachSource(s)` in `src/lib/sa/leadsBooked.ts` matching both new labels. Replace every `=== 'Event'` with this helper across:
- `BookIntroDialog.tsx`, `IntroBookingEntry.tsx`, `EditBookingDialog.tsx`
- `WalkInIntroSheet.tsx`, `BookIntroSheet.tsx`, `PipelineDialogs.tsx`
- `ShiftRecap.tsx`, `SelfSourcedLeadForm.tsx`
- `lib/introScheduler/sourceCodes.ts` (assign code 3 to new label, keep back-compat for '3'→new label)
- `lib/introScheduler/linkUrl.ts` (short-slug branch)

### 5. Coherence proof
After migration:
- `SELECT DISTINCT lead_source FROM intros_booked WHERE lead_source LIKE 'Event%'` — confirm only the two new labels.
- Book a general-outreach lead, confirm it appears on WIG SA leaderboard SGL count.
- Book a `(Friend)` variant, confirm it also fires SOML pending referral.

### Files touched
- `src/types/index.ts`
- `src/lib/sa/leadsBooked.ts`
- `src/components/events/EventPicker.tsx` (rename + rework)
- `src/hooks/useEvents.ts`
- All 8 booking/edit surfaces listed above
- `src/lib/introScheduler/sourceCodes.ts`, `linkUrl.ts`
- 1 migration (schema + data backfill)
