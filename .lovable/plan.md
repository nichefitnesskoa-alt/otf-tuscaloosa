## What's happening

You picked the **Reschedule** outcome on Angelica James, set a new date/time, and hit Reschedule. She's still sitting at Thu 5/14 8:45 AM with Natalya in Upcoming Intros.

I checked the database directly. Her booking row was **not edited by the drawer at all** — `last_edited_at` and `last_edited_by` still show the earlier auto-import from this morning. So the Reschedule click never persisted.

Three things can cause this and the current code can't tell them apart:

1. The Save click ran, the Supabase update silently failed (RLS / trigger / network), and the only signal was a tiny toast you may have missed before it closed the drawer.
2. The drawer's `onSaved` fired before the write actually committed (no read-back), so the UI thought it was done.
3. The Upcoming Intros list is cached and `silentRefresh` ran but Angelica's row was already gone from the new week's window — except the write never happened, so she "stayed."

The fix has to make all three impossible.

## Fix

**File:** `src/components/myday/OutcomeDrawer.tsx` — `handleSave` reschedule branch (around lines 215–255)

1. **Verify the write committed before closing.** Replace the current update with `.update(...).eq('id', bookingId).select('id, class_date, intro_time, coach_name').single()`. If `data.class_date !== newDateStr`, throw — never call `onSaved()`.
2. **Loud, persistent error.** On any thrown error: `console.error('[reschedule]', err)` plus `toast.error(...)` with `duration: 10000` and the actual error message. No silent failures.
3. **Clear pending follow-ups for the original date.** A reschedule means any `follow_up_queue` rows tied to this `booking_id` with `status = 'pending'` should be marked `dormant` so we don't text her about a class she's no longer attending.
4. **Stamp the rebook fields.** Also write `rebooked_at = now()`, `rebook_reason = 'Rescheduled via outcome drawer'`. Today the in-place update doesn't fill these, so reporting can't tell a reschedule from a coach swap.

**File:** `src/features/myDay/UpcomingIntrosCard.tsx`

5. **Optimistic removal.** When `IntroRowCard.onRefresh` fires after a reschedule, drop the card from the current view immediately instead of waiting for the next fetch round-trip. The hook already exposes `silentRefresh`; add a one-shot "hide ids" set so the card disappears on click and is reconciled by the next fetch.

**File:** `src/features/myDay/useUpcomingIntrosData.ts`

6. **Force a fresh fetch, not a cached one.** After a reschedule, invalidate the React Query cache for the upcoming-intros key (both the source week and the target week) so the new date's bucket is repopulated and the old date's bucket loses her.

## Verification before declaring done

- Reschedule a test booking from Thu → next Mon. Confirm:
  - Card disappears from Thu pill (count drops by 1).
  - Card appears under Mon pill (count rises by 1).
  - DB row shows new `class_date`, `intro_time`, `coach_name`, `rebooked_at`, `last_edited_by = current user`, `edit_reason = 'Rescheduled via MyDay outcome drawer'`.
  - Any `follow_up_queue` rows for that booking flip to `dormant`.
- Force a failure (e.g., temporarily break the update) and confirm the toast stays visible long enough to read and `onSaved` is **not** called.
- Re-run on Angelica James after the fix lands so her record actually moves.

No schema changes. No behavior change for other outcomes.