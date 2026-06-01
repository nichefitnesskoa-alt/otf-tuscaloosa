## Goal

Three fixes inside Upcoming Intros on My Day:

1. Make it obvious when the **confirmation text** hasn't been sent (separate from the questionnaire badge, which staff are misreading).
2. Make sure **2nd intros also need a confirmation text** (currently they're treated as "no Q needed" and look fully handled).
3. Add a **loud "Pick the outcome" alert** at the bottom of Upcoming Intros that appears for any intro whose class start time was **more than 1 hour ago** and still has no outcome chosen.

No business logic, attribution, or DB schema changes. Pure UI + a new banner.

---

## 1. Rename / re-style the questionnaire badge

File: `src/features/myDay/IntroRowCard.tsx` (`getQBadgeStatic`, `TappableQBadge`)

- Change every Q badge label to start with the word **"Questionnaire"** explicitly (it already mostly does — the problem is the small `Q!` / `Q?` shorthand in `getQBar` and the short "No Questionnaire" pill being misread as "no text sent"). Re-label the three states to remove ambiguity:
  - `NO_Q` → **"Questionnaire not sent"** (red)
  - `Q_SENT` → **"Questionnaire sent, not answered"** (amber)
  - `Q_COMPLETED` → **"Questionnaire complete"** (green)
- Also fix the `getQBar` banner labels to match (used in `StatusBanner`).

This is just label clarification — same colors, same tap behavior.

## 2. Add a separate "Confirmation text" badge next to the Q badge

File: `src/features/myDay/IntroRowCard.tsx` (summary header bar around line 401)

Add a new pill rendered for **every** intro row (1st AND 2nd intros, but not VIP-session info rows), driven by `item.confirmedAt`:

- `confirmedAt == null` → **red pill "Confirmation text not sent"** — tappable, same behavior as today's "Confirm" action (calls `onConfirm(bookingId)`, which already runs `confirmIntro` and stamps `confirmedAt`). Show "Marked sent ✓" for 2s on tap, like the Q pill does.
- `confirmedAt != null` → **green pill "Confirmation text sent"** (static).

Place it immediately to the left of the Q badge so the two states read as a pair: *Confirmation text · Questionnaire*.

For 2nd intros, **only** show the confirmation pill (no Q pill, no "No Q Needed" pill — keeps the row clean and makes it obvious the only outstanding step is the confirmation text).

## 3. Update the today/tomorrow banners to say "confirmation text"

File: `src/features/myDay/UpcomingIntrosCard.tsx` (lines ~340-385)

- Change banner headlines from "Text & confirm today's/tomorrow's intros" to **"Send confirmation texts for today's/tomorrow's intros"**.
- Subline already counts `!confirmedAt` — leave that math, just reword to "X of Y haven't gotten a confirmation text yet".
- These counts already include 2nd intros (they live in the same `items` array), which matches the new rule that 2nd intros need a confirmation text too.

## 4. New "Pick the outcome" loud alert

File: `src/features/myDay/UpcomingIntrosCard.tsx`

- Compute a new memo `needsOutcomeOverdue`: items where
  - `classDate === todayStr` (only today — past days are handled by the existing "Needs Outcome" tab),
  - `!item.latestRunResult` (or `latestRunResult === 'UNRESOLVED'`),
  - `introTime` is set and `classStart + 60 min < now` (uses the existing `useNowMinute` ticker so it appears live as soon as the window passes),
  - exclude VIP-session info rows (`!item.isVipSession`).
- Render a **bottom-of-card banner** (after the day content, inside `CardContent`) when `needsOutcomeOverdue.length > 0`:
  - Red/destructive styling (`border-2 border-destructive bg-destructive/15`), `AlertCircle` icon, headline **"Pick an outcome — class is over"**, subline "X intro(s) finished over an hour ago and still need an outcome."
  - Primary button **"Jump to first →"** that calls `setSelectedDate(todayStr)` and `setExpandedBookingId(needsOutcomeOverdue[0].bookingId)`, then scrolls that row into view.
- Re-renders every minute automatically via `useNowMinute`.

## Out of scope

- No changes to `confirmIntro` action, `confirmedAt` column, follow-up queue, attribution, canon fields, or Q sending logic.
- No new DB writes — "Confirmation text sent" is still tied to the existing `confirmedAt` flag stamped by the Confirm action / script-copy flow.
- "Needs Outcome" tab logic untouched; the new banner is purely a today-only loud surface so SAs don't forget at end of shift.

## Files touched

- `src/features/myDay/IntroRowCard.tsx` — Q badge wording, new Confirmation-text pill, render rules for 2nd intros.
- `src/features/myDay/UpcomingIntrosCard.tsx` — banner wording, new bottom "Pick an outcome" alert + memo.

## Coherence proof I'll produce after build

- DB query for one row with `confirmedAt = null` and one with `confirmedAt != null` → verify both pills render correctly in preview.
- One past-1h-no-outcome row on today → verify red bottom banner appears and "Jump to first" expands the right card.
- One 2nd-intro row → verify it shows the Confirmation pill and no Q pill.
- Cross-page: tomorrow banner count = `count(items where classDate=tomorrow AND confirmedAt is null)` from `intros_booked`.
