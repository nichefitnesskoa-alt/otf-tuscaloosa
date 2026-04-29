## Problem

In the screenshot, the April Deal script is opened on a real member (Aubrey) — `{first-name}` resolved correctly, but `{first-intro-coach-full-name}` is highlighted as unfilled and is asking the SA to manually type it.

The data is already available — `resolveFirstIntroCoachName(bookingId)` returns the full coach name from `intros_run` / `intros_booked`. The bug is in `MessageGenerator.tsx`:

- It only sets `first-intro-coach-name` (first name only) into context.
- It never sets `first-intro-coach-full-name`, so that token stays unresolved → "Fill in missing fields" shows.

## Fix

Edit `src/components/scripts/MessageGenerator.tsx`:

1. Track both the full and first-name resolutions from `resolveFirstIntroCoachName(bookingId)`:
   - `resolvedFirstIntroCoachFull` = full name
   - `resolvedFirstIntroCoachFirst` = first token of full name
2. In `fullContext`, populate both keys when resolved (and only when not already supplied via `mergeContext`):
   - `first-intro-coach-name` ← first name
   - `first-intro-coach-full-name` ← full name
3. As a final fallback when `bookingId` is present but lookup returns null (TBD coach, missing run/booking row), fall back to the booking's own `coach_name` so the field still auto-fills the majority of the time.

## Outcome

- Coach name (full or first) auto-populates whenever the booking has a coach in either `intros_run` or `intros_booked` (which is the vast majority of cases).
- "Fill in missing fields" only appears in the rare case where no coach is assigned anywhere in the booking chain — matching the user's stated rule.
- No other call sites change; this is a single-file fix that flows through every surface using `MessageGenerator` (My Day cards, Follow-Up queue, Pipeline, Coach pages, Questionnaire Hub, etc.).

## Files

- `src/components/scripts/MessageGenerator.tsx`
