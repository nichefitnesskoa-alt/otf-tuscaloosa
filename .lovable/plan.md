## Goal

Make the "Log a lead you sourced" form on WIG the single place to log any lead (referred or not), with every canonical source available and the referring member captured cleanly whenever the source is a referral / friend variant.

## Problems today

1. `SELF_SOURCED_OPTIONS` in `src/components/leads/SelfSourcedLeadForm.tsx` only lists 6 sources. All the `(Friend)` variants, `Business Partnership Referral`, `Intro Scheduler Link`, `Member Referral (5 class pack)`, `My Personal Friend I Invited`, and `VIP Class` are missing. So SAs can't log those leads at all from WIG.
2. Nothing on the form captures **who referred the lead**. The referring member's name only shows up later at the booking dialog. That means Member-Referral and `(Friend)` leads logged from WIG never get credited as referrals until an intro is booked.
3. `soml_create_pending_referral` only fires on `Member Referral` / `Member Referral (5 class pack)`. `(Friend)` variants — which the user explicitly wants counted as referrals — never enter the referral pipeline.

## Build

### 1. Expand the source list on the form (`SelfSourcedLeadForm.tsx`)
Replace `SELF_SOURCED_OPTIONS` with the full canonical list from `src/types/index.ts` minus the two hard-excluded inbound sources (already codified in `EXCLUDED_LEAD_SOURCES` in `src/lib/sa/leadsBooked.ts`):

```
Business Partnership Referral
Event
Instagram DMs
Instagram DMs (Friend)
Intro Scheduler Link
Intro Scheduler Link (Friend)
Member Referral
Member Referral (5 class pack)
My Personal Friend I Invited
VIP Class
VIP Class (Friend)
Walk-in                      ← keep, not in LEAD_SOURCES but used today
Cold Lead Re-engagement      ← keep
Manual Entry                 ← keep
```

Drive the list from `LEAD_SOURCES` filtered by `isSelfSourcedLeadSource(...)` so it can never drift from the canon again, then append the three form-only extras. Group with `<SelectGroup>`: "Referrals & Friends" first, then "Other sources".

### 2. Referring-member fields appear when the source is a referral
Define a helper `isReferralLikeSource(source)` = true when source is `Member Referral`, `Member Referral (5 class pack)`, `Business Partnership Referral`, `My Personal Friend I Invited`, or ends with `(Friend)`.

When true, render two required fields **above the "Save lead" buttons**:
- `Referring member's full name *`
- `Referring member's phone or email *` (validated same as the /buddy page)

Copy above the fields: "This person was referred — who sent them?"

Persist to `leads.referred_by_member_name` and `leads.referring_member_contact` (columns already exist per the buddy migration).

### 3. Route friend variants into the referral pipeline
Extend `soml_create_pending_referral` in a new migration so `v_is_member_ref` also matches any lead source ending in `(Friend)` PLUS `Business Partnership Referral` and `My Personal Friend I Invited`, provided `referred_by_member_name` is populated. This makes the friend/referral leads count toward SOML pending referrals the same way Member Referral does today. The `$50-off owed` logic from the Buddy Card build is untouched — it stays gated on `is_buddy_card_referral`.

Also relax the existing enforcement trigger (`20260703040117`) so Member-Referral bookings created from a form that already captured the referrer keep working (no change needed — the form now always sends it).

### 4. WIG "+ Add Lead" reuses the same form
`SelfSourcedLeadForm` is already the shared component for MyDay + WIG. No new dialog needed — the WIG entry point automatically gets the expanded sources + referrer capture.

### 5. Book-intro prefill
When "Save and book intro" is used and the source is referral-like, prefill `BookIntroDialog`'s `referred_by_member_name` / `referring_member_contact` from the just-saved lead so the SA doesn't retype.

## Files touched

- `src/components/leads/SelfSourcedLeadForm.tsx` — expand sources, add conditional referrer fields, insert new columns, prefill book-intro.
- `src/lib/sa/leadsBooked.ts` — export `isReferralLikeSource` helper (single source of truth used by form + trigger docs).
- `src/components/leads/BookIntroDialog.tsx` — accept `initialReferredByMemberName` / `initialReferringMemberContact` props for prefill.
- New migration — extend `soml_create_pending_referral` to include `(Friend)` + Business Partnership Referral + My Personal Friend I Invited as referral sources when `referred_by_member_name` is set.

## Coherence checks before done

- DB: insert a test lead with `source='Instagram DMs (Friend)'` + a referrer name → confirm a `soml_pending_referrals` row is created on booking, and confirm the referrer credit shows up in SOML.
- WIG: the "+ Add Lead" dialog shows all 14 sources grouped, and referrer fields appear/disappear based on selection.
- MyDay: `SelfSourcedLeadEntry` gets the identical dropdown and referrer capture (same component).
- SA leaderboard: `aggregateLeadsBookedBySa` still counts these bookings as self-generated (unchanged — `(Friend)` variants were never in `EXCLUDED_LEAD_SOURCES`).
- Buddy Card path untouched — `$50 off owed` still only fires for `is_buddy_card_referral=true`.
