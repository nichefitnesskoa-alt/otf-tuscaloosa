
# Fix Questionnaire Linking and Clean Up Orphaned Records

## Problem
The `QuestionnaireLink` component (used in the Shift Recap form) creates questionnaire records with `booking_id: null`. When the SA later generates a link from the Pipeline's "Questionnaire Links" section (which correctly sets `booking_id`), a duplicate is created. The client fills out the original orphaned one (via their slug), but the system looks for responses on the booking-linked one -- which is empty.

**Chloe Gorman's case:**
- Record `b244fea9` -- linked to booking `ec87d3f8`, status "sent", NO responses
- Record `cb04c3d8` -- no booking link, status "completed", HAS all responses

**Other orphaned records found:** 15 questionnaires with no booking_id, including duplicates for Koa Vincent (4 records, 1 completed) and partial-name fragments like "le", "ry", "chloe" from mid-typing auto-creates.

---

## Fix Part 1: Data Cleanup (SQL)

Run data corrections to:
1. **Chloe Gorman**: Link completed questionnaire `cb04c3d8` to booking `ec87d3f8`, then delete the empty duplicate `b244fea9`.
2. **Koa Vincent**: Find Koa's booking, link the completed questionnaire `601ab894` to it, delete the 3 empty duplicates.
3. **Delete junk records**: Remove orphaned questionnaires with partial names ("le", "ry", "chloe", "sdcs", "abbie", "lydia") that were created mid-typing and never completed.

---

## Fix Part 2: Prevent Future Duplicates (Code)

### `src/components/QuestionnaireLink.tsx`

Change the `createQuestionnaire` function to check for an existing questionnaire by matching `client_first_name`/`client_last_name` (case-insensitive) before creating a new one. If a match is found (especially a completed one), reuse it instead of inserting a duplicate.

The updated logic:
1. Before inserting, query `intro_questionnaires` where `client_first_name` matches (case-insensitive) and `client_last_name` matches.
2. If a completed record exists, adopt it: call `onQuestionnaireCreated(existingId)` and skip insert.
3. If a non-completed orphan exists (with `booking_id = null`), adopt it and update its `booking_id` if available.
4. Only create a new record if no match is found.

### `src/components/PastBookingQuestionnaires.tsx`

Update the questionnaire lookup in `fetchBookings` to also match by client name (not just `booking_id`). This catches the case where a completed questionnaire exists but was never linked to the booking.

The updated logic:
1. After building the `booking_id`-based map, do a second pass: for any booking without a matched questionnaire, check if there's a questionnaire matching the member name (first + last, case-insensitive).
2. If found, link it (update `booking_id` in the database) and use it.

---

## File Summary

| Action | File |
|--------|------|
| SQL data fix | Delete duplicates and link completed questionnaires to correct bookings |
| Edit | `src/components/QuestionnaireLink.tsx` -- add existing-questionnaire lookup before creating |
| Edit | `src/components/PastBookingQuestionnaires.tsx` -- add name-based fallback matching |
