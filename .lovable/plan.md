## Goal

In the Coach intro tab, when a coach (or evaluator) opens an intro card, the First Visit Experience Scorecard should show the **already-submitted scores filled in on the form itself** and stay there. The "FV Scorecards · Self · Koa → Koa · May 8 [L3 · 25/30]" tappable row goes away on this surface.

The same tappable history list keeps working everywhere else it's used (WIG tab, Reports, Notifications, Admin Client Journey).

## What changes

### 1. `src/components/coach/CoachIntroCard.tsx`
- Remove the `<BookingScorecards bookingId={booking.id} />` block and its import (the entire `mb-3` wrapper above the form).
- Fetch existing scorecards for this booking with `useScorecards({ firstTimerId: booking.id })`.
- Pick the scorecard to load into the form using this priority:
  1. The most recent submitted scorecard matching the current `scorecardEvalType` (self vs formal) AND current viewer (`evaluator_name === user.name`).
  2. Otherwise the most recent submitted scorecard matching the current `scorecardEvalType` (any evaluator).
  3. Otherwise the most recent draft for this booking + evalType + viewer.
- Pass that scorecard's id into `ScorecardFormBody` as a new `existingId` prop. When the toggle flips between Self Eval / Formal Eval, the resolved id updates and the form rehydrates.
- Keep the existing inline header "FIRST VISIT EXPERIENCE SCORECARD".

### 2. `src/components/scorecard/ScorecardForm.tsx` (`ScorecardFormBody`)
- The body already supports `existingId` and rehydrates form + bullets via its `useEffect`. No structural change needed beyond making sure that when the parent passes a new `existingId` (after submit or after toggling eval type), the effect re-runs — it already keys on `[existingId]`.
- After successful submit, do **not** clear state. Currently it doesn't — it sets `revealLevel`, leaves all fields populated, and `scorecardId` is retained. Confirm this and leave as-is.
- Add a small read-only header strip above the date/class-type row when `submitted_at` is set on the loaded scorecard: `Submitted by {evaluator_name} · {MMM d}` with the L1/L2/L3 + total badge in OTF Orange. This gives the persistent "score lives on the card" affordance the user asked for, without a separate tappable list.

### 3. Files NOT touched
- `BookingScorecards.tsx`, `ComparisonView.tsx` — keep. Still used by WIG, Reports, Notifications, Admin Client Journey panels where multi-card history is the right pattern.

## Technical notes

- `ScorecardFormBody`'s submit handler already invalidates nothing; the parent (`CoachIntroCard`) should invalidate `['fv_scorecards', { firstTimerId }]` in `onSubmitted` so a freshly submitted card immediately becomes the resolved `existingId` for next mount/toggle.
- Loading order matters: only set `existingId` after the scorecards query resolves. While loading, render the form with `existingId={null}` so the user can start scoring without waiting.
- Self vs Formal toggle continues to work — switching evalType reselects the matching submitted card (or null → blank form for a fresh evaluation in the other mode).

## Files to edit

- `src/components/coach/CoachIntroCard.tsx`
- `src/components/scorecard/ScorecardForm.tsx` (additive: submitted-header strip)

## Out of scope

- WIG tab tappable score list (explicitly kept per user).
- Any change to how Admins view multi-evaluator history.
