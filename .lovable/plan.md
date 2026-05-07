## What I found

Karissa Agnew is in the database **3 times** but the dedup engine misses her:

1. **leads** — "Karissa Agnew", phone `2052706992`, stage `new` (the one showing in New Leads)
2. **intros_booked** — "Karrissa Agnew" (typo, two R's), phone stored as `(205) 270-6992`, status `SECOND_INTRO_SCHEDULED` (4/22)
3. **intros_booked** — "Karrissa Agnew", phone `(205) 270-6992`, status `CLOSED_PURCHASED` (4/29) — **she bought a Basic membership**
4. **intros_run** — buy_date 4/29, BASIC membership

The dedup engine should have caught her on phone alone, regardless of name typo. Two bugs are preventing it:

### Bug 1: Phone format mismatch in dedup query
`detectDuplicate.ts` line 56 queries:
```
.or('phone.eq.2052706992,phone_e164.eq.+12052706992')
```
But `intros_booked.phone` is stored raw as `(205) 270-6992` and `phone_e164` is null on this record. Neither match. **Every lead whose intro was booked before phone normalization rolled out is invisible to dedup.**

### Bug 2: Wrong status constant
Line 61 / 84 check `booking_status_canon === 'PURCHASED'`, but the canon value is actually `CLOSED_PURCHASED`. So even when a phone match works, purchased members get tagged as "prior_intro" instead of "purchased".

## Plan

### 1. Fix phone matching in `src/lib/leads/detectDuplicate.ts`
Replace the strict `.or()` query with a digits-only RPC-style match. Two options, going with the simpler one:
- Fetch candidate rows by last-7-digits substring (`phone.ilike '%270-6992%'` and `'%2706992%'`), then normalize each row's phone client-side and compare to `normalizedPhone`. Same approach already used in PASS 2b for VIP.
- Apply the same fix to PASSES 1b (intros_booked phone), 3 (intros_run phone if present), and 2b (already does it).

### 2. Fix purchased-status detection
Change `booking_status_canon === 'PURCHASED'` → `=== 'CLOSED_PURCHASED'` in PASS 1b and PASS 2 (lines 61, 84). Update `summaryNote` to say "purchased membership on {date}" so it's clear in the Already-in-System list.

### 3. Mark Karissa's lead now
Update `leads.id = c2e93938-55cb-4cf5-9aef-dd12a0aac716`:
- `stage = 'already_in_system'`
- `duplicate_confidence = 'HIGH'`
- `duplicate_match_type = 'phone'`
- `duplicate_notes = 'Phone match: Karrissa Agnew — purchased Basic membership on 2026-04-29'`
- `booked_intro_id = 6d9cb2f0-7e08-4580-94af-341a4b3f05fd`

### 4. Background re-check picks up the rest
The 5-min `backgroundDedupRecheck` loop will reclassify any other leads with the same root cause within minutes of the fix shipping — no manual cleanup needed.

## Files to change
- `src/lib/leads/detectDuplicate.ts` — phone matching + purchased status
- One data update via insert tool for Karissa's lead

## Verification
- Reload My Day → Karissa drops out of New Leads, appears in Already in System with "purchased" badge
- Spot-check 2-3 other "new" leads with phones that exist in `intros_booked` raw format → they reclassify within 5 min
