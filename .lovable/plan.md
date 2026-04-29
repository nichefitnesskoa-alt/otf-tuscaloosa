## What went wrong

Yesterday's backfill migration (`20260429031846`) inserted a `vip_registrations` row for every VIP-class booking that didn't already have a `booking_id`-linked registration. But Bama Catholic members had **already self-registered** through the public VIP form — those rows existed with `booking_id = NULL`. When you later booked their intros, the backfill saw "no registration linked to this booking" and inserted a *second* row, instead of attaching the booking to the existing self-reg row.

Result in the My Day group card for Bama Catholic:
- Jenna Nygaard ×2, Kaelyn Bannon ×2, Siena Warriner ×2 (+1 group contact = 3), Emily Signor ×2
- Elise Jurkovic ×2 — same person, but her phone digits differ across the two rows (`904480426` vs `(904) 480-426`), which is a separate normalization issue

The same `auto_create_vip_registration` trigger has the same bug for any *future* booking of a member who already self-registered: it only checks `booking_id`, not phone/name match, so it'll keep duplicating.

## Fix

### 1. Database migration — dedupe + harden trigger

**a) Merge duplicates (keep the oldest, attach the booking_id to it):**
For every (`vip_session_id`, normalized phone) pair with multiple rows:
- Pick the earliest-created row as the survivor
- If any sibling has a `booking_id` and the survivor doesn't, copy that `booking_id` (and email, last_name if missing) onto the survivor
- Re-point any FK references (none expected, but safe to check `booking_id` uniqueness)
- Delete the duplicate rows

Phone normalization for matching = strip everything but digits, keep last 10 digits. This collapses Elise's `904480426` (9 digits — clearly a malformed entry, will be treated as its own phone) vs `(904) 480-426` (also 9 digits when stripped — they actually match). Both Elise rows normalize to `904480426` → merge.

For rows with no phone, fall back to (`vip_session_id`, lower(first_name), lower(last_name)).

**b) Add a unique partial index** to make duplicates impossible going forward:
```
CREATE UNIQUE INDEX vip_registrations_session_phone_uniq
  ON vip_registrations (vip_session_id, regexp_replace(phone, '\D', '', 'g'))
  WHERE phone IS NOT NULL;
```

**c) Rewrite the `auto_create_vip_registration` trigger** so that when a VIP-class booking is inserted, it:
1. Looks up an existing `vip_registrations` row in the same `vip_session_id` matching by normalized phone (or name fallback).
2. **If found:** updates that row's `booking_id` (and fills `last_name`/`email` if blank). No insert.
3. **Only if no match exists** does it insert a new row.

This makes self-reg → later booking flow correctly attach instead of duplicate.

### 2. App code — `VipPipelineTable.handleAddMember`

Mirror the same "match-or-create" logic in `src/features/pipeline/components/VipPipelineTable.tsx`:
before inserting a new `vip_registrations` row, query for an existing one in that session by normalized phone. If found, update it with the new `booking_id` instead of inserting.

This keeps the UX path safe even if the trigger is ever bypassed.

### 3. Verification queries (run after migration)

- Bama Catholic session should show: Audrey, Caroline, Chloe, Elise (1), Emily, Ethan, Grace, Hana, Jenna, Kaelyn, Lucas, Siena (1 attendee + 1 group contact)
- No `vip_session_id`+normalized-phone pair has count > 1
- Every booking with `lead_source='VIP Class'` and a `vip_session_id` has exactly one `vip_registrations` row pointing at it

### Files to change

- New migration: dedupe + unique index + rewritten trigger
- `src/features/pipeline/components/VipPipelineTable.tsx` — match-or-update in `handleAddMember`

### Out of scope (flagging only)

The `904480426` (9-digit) phone on Elise's booking is a separate data-entry/normalization bug. After dedupe she'll be one row with `(904) 480-426`. If you want, a follow-up pass can re-normalize all `intros_booked.phone` values through the same NANP rules used elsewhere — say the word and I'll add it.