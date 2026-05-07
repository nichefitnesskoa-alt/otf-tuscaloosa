## Problem

The "New Leads" sub-tab in My Day filters by `stage = 'new'`. Leads get moved out of `new` only when the dedup engine returns **HIGH** confidence (→ `already_in_system`) or **MEDIUM** (→ `flagged`). Today's dedup engine (`src/lib/leads/detectDuplicate.ts`) only checks:

1. `intros_booked` (phone, email, name+date, name-only)
2. `intros_run` (name+date)
3. `sales_outside_intro` (name)

It **does not check `vip_registrations` at all**. So someone who registered for a VIP class but has no `intros_booked` row still appears as a brand-new lead. It also can miss people who are already in the active sales pipeline if they only exist as a `leads` row in `contacted` / `flagged` stages (rare but worth verifying).

## Goal

When a new lead arrives, automatically detect and remove from the "New Leads" list anyone who is:

1. **Already a VIP class registrant** (matches a row in `vip_registrations` by phone, email, or name)
2. **Already in our pipeline** as an existing `intros_booked` / `intros_run` row (already handled, but currently only `phone`/`email`/`name+date` — confirm it catches the "already in pipeline" case the user is seeing)

Hide them from the New Leads tab without losing the record (mark `stage = 'already_in_system'` so they show up in the existing "Already in System" sub-tab and stay auditable).

## Plan

### 1. Add VIP registration pass to dedup engine
File: `src/lib/leads/detectDuplicate.ts`

Add a new check that runs **before** the name-only fallback (after the phone/email passes, alongside `sales_outside_intro`):

- Query `vip_registrations` by:
  - normalized phone (10-digit, regex strip)
  - normalized email (case-insensitive)
  - lowercased `first_name + last_name` exact match
- If any row matches:
  - Return `confidence: 'HIGH'`, `matchType: 'phone' | 'email' | 'name_date'`
  - `existingStatus: 'prior_intro'` (closest existing enum value — they are a known VIP contact)
  - `summaryNote: "VIP class registrant: {name} — {vip_class_name}"`
  - `matchedRecord.table: 'vip_registrations'`

Because confidence is HIGH, `confidenceToStage()` will move the lead to `already_in_system`, removing it from the New Leads sub-tab automatically.

### 2. Trigger a re-check on existing new/flagged leads
The continuous dedup loop (`backgroundDedupRecheck` in `MyDayNewLeadsTab.tsx`) already runs on mount + every 5 minutes against all `new`/`contacted` leads. Once the engine is updated, existing leads matching a VIP registrant will be re-classified on the next pass. **No changes needed there** — but on first deploy, leads will reclassify within ~1.5s of opening My Day.

### 3. (Optional, confirm) Catch "already in pipeline" leads earlier
Phone/email matches against `intros_booked` already work. The user said "already in our pipeline" — this likely means VIP registrants. Confirm this matches their case before adding any other tables.

## Technical Details

- `vip_registrations` has columns: `first_name`, `last_name`, `phone`, `email`, `vip_class_name`, `vip_session_id`, `booking_id`, `is_group_contact`. No soft-delete column to filter on.
- Phone normalization in `detectDuplicate.ts` already strips to 10 digits — reuse `normalizePhone()`.
- VIP registrations may have phone stored in raw format (e.g. `(205) 555-1234`) — query needs `regexp_replace` server-side OR fetch candidates and match client-side. Simplest: fetch candidates by name, then verify phone/email client-side. Keep query under 100 rows.
- Group-contact rows (`is_group_contact = true`) often have placeholder names — still match them by phone/email but skip pure name matches when `is_group_contact = true` to avoid false positives.

## Files to Change

- `src/lib/leads/detectDuplicate.ts` — add VIP registration pass

## Out of Scope

- No DB migration needed
- No changes to `MyDayNewLeadsTab.tsx` filter logic (the `stage='new'` filter already does the right thing once dedup reclassifies)
- No changes to the "Already in System" sub-tab UI

## Verification

1. Pick a known VIP registrant who is currently in New Leads
2. Reload My Day → within ~2s, they move to "Already in System" sub-tab with note "VIP class registrant: ..."
3. New leads count badge decreases accordingly
4. Manually create a new lead with the same phone as a VIP registrant → instantly classified as `already_in_system`