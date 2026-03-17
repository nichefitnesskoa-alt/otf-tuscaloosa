

## Problem

Q% is currently calculated from the **booking** side (matching bookings to showed IDs, then attributing via `b.intro_owner`). But the user wants it driven from the **run** side: "Of the intros **I ran**, how many had a completed questionnaire?" This also ensures the attribution matches exactly — same SA, same denominator as the Ran column.

Additionally, the user wants:
1. A new **"Q Done"** column showing the raw count (e.g. "3" out of 5 ran)
2. Clearer labeling so it's obvious Q% = questionnaires completed ÷ intros ran

## Plan

### 1. `src/hooks/useLeadMeasures.ts` — Rewrite Q% logic around runs

Instead of iterating bookings to compute Q%, iterate **runs** (non-no-show) and look up the linked booking's `questionnaire_status_canon`:

- For each non-no-show run, get the `linked_intro_booked_id`
- Find the matching booking
- If `questionnaire_status_canon === 'completed'`, increment `qCompleted`
- `qTotal` = same as `introsRan` (every run counts toward the denominator)
- Attribution uses `r.intro_owner || r.sa_name` — identical to the Ran attribution

This replaces the current booking-side Q loop entirely. Prep% stays on the booking side (inside `showedBookingIds` guard) since prep is a booking-level action.

Add `qCompleted` as a raw number to the `SALeadMeasure` interface (rename or add `qCompletedCount`).

### 2. `src/hooks/useLeadMeasures.ts` — Update interface

Add `qCompletedCount: number` to `SALeadMeasure` so the table can show the raw count.

### 3. `src/components/dashboard/LeadMeasuresTable.tsx` — Add "Q Done" column + update labels

- Add a new column **"Q Done"** between SA and Q% showing `qCompletedCount` / `introsRan` (e.g. "3/5")
- Update the Q% tooltip to say: "Of the intros this SA ran, what % had a completed questionnaire beforehand?"
- Update the footer text to clarify: "Q = questionnaires completed out of intros ran"

