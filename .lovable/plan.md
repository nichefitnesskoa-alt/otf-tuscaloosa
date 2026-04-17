

## Root cause

`BookIntroSheet`'s "Reschedule existing member" path writes `rebooked_from_booking_id` but **never sets `originating_booking_id`**. CoachView identifies 2nd intros solely by `originating_booking_id`, so Helen's 2nd booking shows "1st Intro" there. MyDay catches it via a fallback prior-run lookup, which is why the two sides disagree.

The canonical field for "this is a follow-up to an earlier booking by the same person" is `originating_booking_id` (per the Intro Owner Management memory: 2nd intros must inherit `intro_owner` from the originating booking via this column). `rebooked_from_booking_id` is a separate concept used for cancel/reschedule audit. The reschedule path conflates them.

## Fix

### 1. `src/components/dashboard/BookIntroSheet.tsx` — set `originating_booking_id` when rebooking an existing member

In `handleSave`, when `selectedBooking` exists, also write:
```ts
originating_booking_id: selectedBooking.originating_booking_id || selectedBooking.id,
```

Use the original booking's `originating_booking_id` if it has one (so a 3rd intro still chains back to the true 1st), otherwise point to the selected booking. Keep `rebooked_from_booking_id` as-is for audit.

Also pull `originating_booking_id` into the `SearchResult` select query and type so we can inherit it correctly.

### 2. One-time backfill migration

Find existing bookings created by this broken path and link them:
```sql
UPDATE intros_booked b
SET originating_booking_id = COALESCE(orig.originating_booking_id, orig.id)
FROM intros_booked orig
WHERE b.rebooked_from_booking_id = orig.id
  AND b.originating_booking_id IS NULL
  AND b.deleted_at IS NULL;
```
This fixes Helen's current booking and any others stuck in the same state.

## Files changed
1. `src/components/dashboard/BookIntroSheet.tsx` — add `originating_booking_id` to insert + `SearchResult` query
2. New migration — backfill `originating_booking_id` from `rebooked_from_booking_id` where missing

## Files audited, no change needed
- `src/pages/CoachView.tsx` — logic is correct, just needed the field populated
- `src/features/myDay/useUpcomingIntrosData.ts` — already detects correctly via prior-run fallback

## Downstream effects (all positive, all explicit)
- CoachView shows Helen's booking as a one-line 2nd Intro stub (matches My Day)
- 2nd intro `intro_owner` correctly inherits from originating booking via existing canon (per Intro Owner memory)
- Total Journey close-rate credit flows to the original 1st-intro coach (already wired off `originating_booking_id`)
- No-show originating bookings still correctly demote the chain (CoachView's existing `originatingStatuses[id] !== 'NO_SHOW'` check)
- Friend bookings unaffected (separate `referred_by_member_name` path, no rebook involved)
- VIP, COMP isolation unaffected
- No RLS changes, no new tables

## Confirm before building
None — fix is mechanical and matches existing canon.

