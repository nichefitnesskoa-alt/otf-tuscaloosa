## Make "Log Sent" clear the follow-up card

Right now, tapping **Log Sent** on a follow-up card just records a `script_actions` row and shows a toast. The card stays put, which is the opposite of what should happen — once you've reached out, that person should be off your list for the day.

### What changes

**File: `src/features/followUp/FollowUpList.tsx`**

Update `handleLogSent` in `FollowUpCard` so it does two things:

1. **Insert into `script_actions`** (unchanged) — so the daily "follow-ups sent" counter on My Day still increments.
2. **Mark the booking as dismissed for today's queue** by setting `intros_booked.followup_dismissed_at = now()` on `item.bookingId`.

Then call `onRefresh()` so the list re-reads. The existing fetch in `useFollowUpData` already filters out bookings with `followup_dismissed_at IS NOT NULL` (line 139), so the card will disappear immediately — no new query logic needed.

Toast copy changes from `"Logged as sent"` to `"Logged — cleared from today's list"` so the user knows why the card vanished.

### Why this works without breaking anything

- `followup_dismissed_at` is already used by the **swipe-left → Not Interested** flow at the bottom of the same file (lines 333–345). We're reusing the exact same dismissal mechanism, just without marking them "not interested" in `follow_up_queue` — so they'll naturally come back into the queue on the next outcome cycle if needed (e.g., if their `contactNextDate` rolls forward and someone re-opens them via outcome edit).
- Wait — that's the catch. Setting `followup_dismissed_at` permanently removes them from the queue, which is too aggressive for "I sent a text today, show them again in a few days."

### Better approach: use cooling, not dismissal

The list already has 7-day cooling logic via `lastContactAt` (read from `script_actions`), and a "Focus Today" vs "Coming Up" split based on `contactNextDate`. The cleanest fix:

1. Insert the `script_actions` row (already happens).
2. Update `intros_booked.reschedule_contact_date` to **3 days from today** (or read the per-type cadence from `computeContactNext`-style logic) so the card moves from **Focus Today** into **Coming Up**.
3. Call `onRefresh()`.

Result: the card disappears from the visible "Focus Today" section (which is what the user sees by default — "Coming Up" starts collapsed), but the person isn't lost — they reappear in a few days when it's time for the next touch.

Toast: `"Logged — next touch in 3 days"`.

### Recommended implementation

Go with the **cooling approach** above, not permanent dismissal. Specifically:

- In `handleLogSent`:
  - Insert `script_actions` row (existing code).
  - Compute new contact-next date based on `item.followUpType`:
    - `noshow_1st` / `noshow_2nd` → +2 days
    - `reschedule` → +2 days
    - `didnt_buy_1st` / `didnt_buy_2nd` → +3 days
    - `planning_to_buy` → +2 days
  - Update `intros_booked.reschedule_contact_date` for `item.bookingId` to that ISO date.
  - Toast: `"Logged — next touch {date}"` (e.g., "Logged — next touch May 2").
  - `onRefresh()`.

Since `Coming Up` is collapsed by default, the card visually disappears from the user's view immediately. They can expand `Coming Up` if they want to see it.

### Out of scope

- No changes to `CoachFollowUpList` (separate component).
- No changes to `script_actions` schema or the daily counter on My Day.
- No changes to `follow_up_queue` ownership / not-interested logic.
- No changes to the swipe-left "Not Interested" flow.
