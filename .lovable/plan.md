# Fix metric mismatch on rescheduled first intros

## Root cause

`originating_booking_id` is being used for two different concepts in code that should be separate:

1. **True 2nd intro chain** — member ran a first intro, then booked a separate second visit.
2. **Reschedule** — same first intro, moved to a new date.

When a no-showed first intro is rebooked, the new row gets `originating_booking_id` set, so every "first intro" filter, the Total Journey walker, and orphan-promotion treat the rebook as a 2nd intro. Result for Jessica Booker:

| Surface | What it does | Jessica |
|---|---|---|
| Studio Scoreboard | Counts every SALE run | ✅ +1 sale |
| Per-Coach drill (Studio tab) | Credits close to **1st intro** coach (TBD on the no-show row) | ❌ drops |
| WIG page | Same Total Journey walker | ❌ drops |

`rebooked_from_booking_id` already exists for this purpose and is being set in parallel. We just need to make it the only link for reschedules and stop writing `originating_booking_id`.

VIP-class attendee behavior (Chatham, Madison) stays as-is per your call.

## Plan

### 1. Stop writing `originating_booking_id` on reschedule paths

- **`src/components/dashboard/RebookDialog.tsx`** — remove `originating_booking_id: bookingId`. Keep `rebooked_from_booking_id`, `rebook_reason`, `rebooked_at`. This dialog is for rebooks/reschedules, never true 2nd intros.
- **`src/components/myday/OutcomeDrawer.tsx`** — reschedule path already updates in place (good). No code change here; the bad row came from a different surface, which we cover above.
- **`src/lib/domain/outcomes/applyIntroOutcomeUpdate.ts`** — keep `originating_booking_id` only when `rebook_reason === 'second_intro'` (true 2nd intro flow). No change needed; it already gates on the 2nd-intro branch.

### 2. Mark the superseded original as not-counted

When a reschedule is created, flip the original booking so it stops contributing to denominators:

- Set `booking_status_canon = 'RESCHEDULED'` and `ignore_from_metrics = true` with `edit_reason = 'Superseded by reschedule'` on the original row.
- Extend `src/lib/intros/excludedBookings.ts` so `booking_status_canon === 'RESCHEDULED'` is excluded.
- Add `'RESCHEDULED'` to `src/lib/domain/outcomes/types.ts` canon list and validation trigger (`validate_booking_status_canon` if present — DB allows free text today so no trigger to update).

### 3. Data migration (one-time, idempotent)

For every existing booking where `rebooked_from_booking_id IS NOT NULL` (or `rebook_reason` is anything except `'second_intro'`):

- `UPDATE intros_booked SET originating_booking_id = NULL WHERE rebooked_from_booking_id IS NOT NULL AND (rebook_reason IS NULL OR rebook_reason <> 'second_intro');`
- For each such row, flip the linked original: `UPDATE intros_booked SET booking_status_canon = 'RESCHEDULED', ignore_from_metrics = true, edit_reason = 'Backfill: superseded by reschedule' WHERE id IN (SELECT rebooked_from_booking_id ...) AND booking_status_canon NOT IN ('RESCHEDULED', 'DELETED_SOFT');`

Jessica's specific result after migration:
- `8d88…` (May 2 NO_SHOW) → `booking_status_canon = 'RESCHEDULED'`, excluded from metrics.
- `79ef…` (May 25 SALE) → `originating_booking_id = NULL`, becomes a first intro on its own.

### 4. Verify cross-surface coherence

Manually check Jessica + the 7 other people in the May 1–31 Koa drill:
- Studio Scoreboard sales count unchanged (still includes Jessica).
- Per-Coach drill Koa row: Coached count goes up by 1, Closes goes up by 1, Jessica appears with `SALE` label and `via: direct`.
- WIG page Koa close count matches Per-Coach.
- Reconciliation footer in the drill: `Counted as Coached` = `Counted as Close (direct)` + others, no longer drops Jessica.

Also spot-check 1–2 other rescheduled bookings in the DB to confirm they now route to a single first-intro row.

## Files touched

- `src/components/dashboard/RebookDialog.tsx` (remove `originating_booking_id`, add status flip on original)
- `src/lib/intros/excludedBookings.ts` (add `RESCHEDULED`)
- Supabase migration: backfill `originating_booking_id` and `booking_status_canon` for reschedule rows
- No changes to journey.ts / orphanedFirstIntros.ts / PerCoachTable.tsx / WIG — they automatically agree once the data is shaped correctly

## Out of scope (per your direction)

- VIP-class purchases (Chatham, Madison) keep counting as coach intros + closes.
- No behavior change to true 2nd intros — those still chain via `originating_booking_id` and use Total Journey attribution to the first-intro coach.
