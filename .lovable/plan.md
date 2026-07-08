## What's broken

The inline lead-source dropdown on the MyDay intro card (the "· Online Intro Offer (self-booked) ·" pill in the card header) writes only the `lead_source` column to the database. When you switch to a "(Friend)" source like `Instagram DMs (Friend)`, the DB trigger `enforce_member_referral_has_referrer` rejects the update because no referring member is attached → the toast shows "Save failed" and the value snaps back.

This affects every "(Friend)" and referral source (`Member Referral`, `My Personal Friend I Invited`, all the `... (Friend)` variants — including the three new ones we just added).

Every other surface that edits lead source (Pipeline spreadsheet inline editor, Edit Booking dialog, Reschedule dialog, Person Journey drilldown) already uses the shared `LeadSourceWithReferrerField` and doesn't hit this bug — the header pill on the intro card is the only place still writing `lead_source` in isolation.

Separately, the Person Journey drilldown's referring-member field is a plain `<Input>` (screenshot 2 — "Andre" typed by hand) instead of the shared `NameAutocomplete` that pulls from prior members / leads / IG leads.

## Fix

**1. Fix the inline header on the intro card (`src/components/shared/IntroCard.tsx`)**

Replace the `InlineSelect` used for `lead_source` with a new inline component that behaves like the pipeline inline editor:

- Click the pill → opens a small popover anchored to the pill.
- Popover renders the shared `LeadSourceWithReferrerField` (compact size). This gives us the full canonical `LEAD_SOURCES` list AND — when the chosen source is referral-like — the `NameAutocomplete` referrer field.
- Save button (orange check) and Cancel (X), matching the pipeline inline editor pattern the user is used to.
- On save:
  - Validate with `validateLeadSourceReferrer`; block save + inline error if referrer missing.
  - Single Supabase update writes `lead_source` AND `referred_by_member_name` (normalized via `resolveReferrerForWrite`, so switching away from a friend source clears the stale referrer) in one call, plus `last_edited_at` / `last_edited_by`.
  - Optimistic local update; on error, roll back and toast.
  - After save, still invoke the existing `handleLeadSourceChanged` hook so the VIP auto-detect flow keeps working when the new source is a VIP source.
- Keep the coach inline dropdown, time picker, date picker, and phone editor exactly as they are — those work today.

**2. Person Journey drilldown referrer field (`src/components/person/PersonJourneyCard.tsx` around line 548)**

Replace the plain `<Input>` for "Referring member's full name" with `NameAutocomplete` so it suggests prior members / leads / IG leads (which is what the user wants: "anytime there's a member's full name, pull previous people in the pipeline"). No behavior change other than the input type — it still writes through the same `commitEdit` path.

**3. Audit — every referring-member input in the app**

`NameAutocomplete` is already used by `LeadSourceWithReferrerField`, so Pipeline inline, Edit Booking dialog, Reschedule dialog, MyDay Edit Booking, Self-Sourced Lead form, and the new inline header (after fix #1) all get autocomplete for free. Only the Person Journey drilldown (fix #2) is the outlier — no other plain-Input referrer surfaces exist.

## Coherence proof I'll produce before reporting done

- Change Sierra Roberts' `lead_source` from `Online Intro Offer (self-booked)` → `Instagram DMs (Friend)` with referrer `Andre Roberts` via the MyDay inline header. Verify with `read_query` that `intros_booked` row `fdd9416d-a490-4976-9dc3-5ddc83366c87` has `lead_source = 'Instagram DMs (Friend)'` AND `referred_by_member_name = 'Andre Roberts'`.
- Then change it back to `Online Intro Offer (self-booked)` inline and verify `referred_by_member_name` is now `null` (stale referrer cleared).
- Type "and" into the drilldown referrer field on the same booking and verify the autocomplete popover shows prior members from `intros_booked` (e.g. "Andre Roberts", "Andrea …").
- Cross-page numbers: WIG SOML pending-referral count for Andre Roberts +1 after step 1, back to baseline after step 2. SGL leaderboard credit unchanged (Grace F still owns the booking's `intro_owner`).

## Files touched

- `src/components/shared/IntroCard.tsx` — swap header lead-source `InlineSelect` for popover editor using `LeadSourceWithReferrerField`.
- `src/components/person/PersonJourneyCard.tsx` — swap referrer `<Input>` for `<NameAutocomplete>`.

No DB migration, no changes to metric logic, no other consumers touched.