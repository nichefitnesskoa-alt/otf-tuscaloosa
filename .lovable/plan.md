## What I found

Angelica did get updated by the My Day reschedule flow, but then the sheet import moved her back:

- Current booking: Angelica James, 2026-05-14 at 8:45 AM with Natalya.
- The row has `rebook_reason = Rescheduled via MyDay outcome drawer`, so the drawer write happened.
- Then `last_edited_by = System (Sheet Import)` and `edit_reason = Auto-rescheduled from 2026-05-19 via sheet import`, meaning the import saw the stale original Mindbody row and overwrote the manual reschedule.

## Fix plan

1. **Protect manual reschedules from stale sheet rows**
   - Update `supabase/functions/import-sheet-leads/index.ts` so the auto-import does not move a booking back when the existing booking has a manual reschedule stamp from My Day.
   - Treat those stale sheet rows as skipped duplicates instead of reschedule commands.
   - Record the skip in `intake_events` with a clear reason like `manual_reschedule_protected`.

2. **Only auto-reschedule when the incoming sheet row is actually newer**
   - Add a guard before the import updates an existing active booking on a different date.
   - If the existing booking was manually edited after the original intake event / stale row, do not let the sheet import overwrite it.
   - This keeps true Mindbody reschedules working while blocking old rows from undoing staff work.

3. **Strengthen the My Day refresh after successful reschedule**
   - In `UpcomingIntrosCard`, add a one-shot hidden booking id set for rows that just saved a reschedule.
   - In `IntroRowCard`, close the outcome drawer after save and call the parent refresh with the booking id so the old-day card disappears immediately.
   - Keep the DB read-back already added in `OutcomeDrawer` so the UI only hides after the write commits.

4. **Repair Angelica’s live row**
   - Move Angelica James back to the newly selected date/time if it can be determined from recent state.
   - If the target date/time is not recoverable from app/database state, I will need you to confirm the intended new date/time before changing live data.

## Verification

- Query Angelica’s booking before and after.
- Confirm `last_edited_by` no longer becomes `System (Sheet Import)` from a stale import after a manual reschedule.
- Confirm My Day no longer shows the card on the old date immediately after save.
- Confirm follow-up queue rows tied to that booking remain dormant/cleared.