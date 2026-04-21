

## Goal
Two changes to the My Day VIP registrants sheet:

1. **Trim the outcome dropdown** to only the four outcomes that matter for VIP attendees: `Showed`, `No-show`, `Booked intro`, `Purchased`. Drop `Interested`, `Not interested`.
2. **Restore the "Booked Intro" booking flow** — when an SA picks `Booked intro` for a VIP attendee, open the standard Book Intro sheet pre-filled with that attendee's name, `lead_source = 'VIP Class'`, and `vip_session_id` set. Saving the booking creates a real `intros_booked` row tied to the VIP session (same as before the recent changes).

## Changes

**`src/features/myDay/VipRegistrationsSheet.tsx`**
- `OUTCOME_OPTIONS` becomes exactly:
  - `showed` → "Showed"
  - `no_show` → "No-show"
  - `booked_intro` → "Booked intro"
  - `purchased` → "Purchased"
- `OUTCOME_LABELS` (used in the aggregate roll-up at top) trimmed to the same four.
- When the user selects `booked_intro` from a row's dropdown:
  1. Save the outcome to `vip_registrations.outcome` (existing logic).
  2. Open `BookIntroSheet` with prefill:
     - `member_name` = attendee's `first_name + last_name`
     - `phone` / `email` = pulled from that registration row (need to add these back to the query — privacy is preserved since it's a deliberate booking action by the SA)
     - `lead_source` = `'VIP Class'`
     - `vip_session_id` = current VIP session id
     - `coach_name` = the coach picker value (already on this sheet)
  3. On successful booking save, the registration row keeps `outcome = 'booked_intro'` and the new intro shows up on My Day under the standard intros list (already happens via existing realtime/refetch).
- Query update: re-add `first_name, last_name, phone, email` to the `vip_registrations` select (needed for prefill). PII still never renders in the row UI — rows still show `Attendee N` style or just the dropdown; phone/email are used only as prefill payload when the SA clicks Booked intro.
  - **CONFIRM THIS VALUE** — last turn the user said "I do want to see names in the VIP group card." So row labels should show `first_name + last_name` (not "Attendee N"). Building it that way unless told otherwise.

**`src/components/dashboard/BookIntroSheet.tsx`** (or whichever Book Intro sheet `MyDayPage` already uses — will confirm by reading both `BookIntroSheet.tsx` and `IntroBookingEntry.tsx` during build)
- Accept new optional props: `prefillName`, `prefillPhone`, `prefillEmail`, `prefillLeadSource`, `prefillVipSessionId`, `prefillCoachName`.
- When opened with these, populate the form fields. `vip_session_id` saves to `intros_booked.vip_session_id` so the new intro is linked back to the VIP session for attribution.
- All other Book Intro behavior unchanged.

**No changes** to:
- `OutcomeDrawer.tsx` (the actual intro card outcome list — separate surface).
- Reporting carve-outs for `VIP_CLASS_INTRO`.
- `vip_registrations` schema.
- VIP signup flows.
- RLS / role permissions.

## Downstream effects
- VIP card on My Day now offers exactly four outcomes per attendee: Showed, No-show, Booked intro, Purchased. The aggregate roll-up at the top reflects only these four.
- Picking `Booked intro` saves the outcome AND opens the standard Book Intro sheet pre-filled with that person's name, phone, email, lead source `VIP Class`, the VIP session id, and the coach selected at the top of the VIP sheet. Saving creates a real `intros_booked` row that appears on My Day as a normal intro.
- Names visible in the VIP card rows (per user's last instruction).
- Picking `Purchased`, `Showed`, or `No-show` just saves to `vip_registrations.outcome` — no booking is created (those are pure status logging).
- Notifications still anonymous (last build).
- Central Time preserved everywhere.
- No retroactive change.
- No RLS/role changes.

