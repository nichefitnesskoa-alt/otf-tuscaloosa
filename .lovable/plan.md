## Problem

Changing a booking's lead source to any referral / friend source has no place to enter the referring member. In MyDay's Edit Booking dialog the referring-member field only shows for "Member Referral" and "Member Referral (5 class pack)" — every `(Friend)` variant and `Business Partnership Referral` / `My Personal Friend I Invited` silently skips it. In the WIG drilldown (PersonJourneyCard) the inline Lead Source select has no referrer input at all, so the `enforce_member_referral_has_referrer` DB trigger rejects the update ("Member Referral bookings require a referring member name") with no way to comply.

## Fix

### 1. `PersonJourneyCard` (WIG drilldown inline edit)
When the inline `lead_source` editor is open AND the draft value passes `isReferralLikeSource(...)`, render a required "Referring member's full name" text input directly below the source select. Pre-fill from the booking's existing `referred_by_member_name`. Block commit with a toast if empty. Pass the value into `updateBookingFieldsFromPipeline` alongside `leadSource`.

### 2. `updateBookingFieldsFromPipeline` (`src/features/pipeline/pipelineActions.ts`)
Add optional `referredByMemberName?: string | null` to `BookingFieldParams` and, when defined, write it to `intros_booked.referred_by_member_name`. No other call sites break — existing callers omit the field and behavior is unchanged.

### 3. `EditBookingDialog` (MyDay)
Replace the hardcoded `source === 'Member Referral' || source === 'Member Referral (5 class pack)'` checks (in both the render guard and the save validation) with `isReferralLikeSource(source)` from `@/lib/sa/leadsBooked`. Copy on the field becomes "Referring member's full name *" and appears for every referral / friend source. Save persists `referred_by_member_name` for all referral-like sources and clears it when the source moves back to a non-referral.

### 4. DB enforcement trigger — expand to match
Update `enforce_member_referral_has_referrer` so it raises on every referral-like source (`Member Referral`, `Member Referral (5 class pack)`, `Business Partnership Referral`, `My Personal Friend I Invited`, and any source ending in `(Friend)`) when `referred_by_member_name` is missing. This is the SQL mirror of the client-side `isReferralLikeSource` helper — single source of truth in two languages, same rule in both places, so no path can slip through without a referrer.

## Files touched

- `src/features/pipeline/pipelineActions.ts` — add `referredByMemberName` param.
- `src/components/person/PersonJourneyCard.tsx` — inline referrer input when editing to a referral-like source, validation, pass-through to the action.
- `src/components/myday/EditBookingDialog.tsx` — swap hardcoded Member Referral checks for `isReferralLikeSource`.
- New migration — extend `enforce_member_referral_has_referrer` to all referral-like sources.

## Coherence proof (to run after build)

- DB: run an UPDATE against a booking setting `lead_source='Instagram DMs (Friend)'` with `referred_by_member_name=NULL` → confirm trigger raises. Repeat with a name → confirm success and that `soml_pending_referrals` row is created for the friend variant (already wired in prior migration).
- WIG drilldown → change Lauren Moerbe's booking from Member Referral to `Instagram DMs (Friend)` → referrer field appears, save succeeds, DB row shows updated `lead_source` + `referred_by_member_name`.
- MyDay Edit Booking dialog → same booking, change to `VIP Class (Friend)` → referrer field appears, save succeeds.
- New leads logged from the WIG "+ Add Lead" form (existing build) still work — no schema change to `leads`, only the trigger on `intros_booked` changed.
