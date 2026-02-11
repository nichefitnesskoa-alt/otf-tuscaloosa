
# Fix Questionnaire Display, Pipeline Layout, and Add Quick-Create Links

## Issues Found

**Completed Questionnaires Not Showing**: Chloe Gorman's completed questionnaire (cb04c3d8) still has `booking_id = null`, while her booking is linked to an empty duplicate (b244fea9). The code finds the empty one first by booking_id and never falls through to the name-based match. SQL cleanup is needed again, plus a code fix to prefer completed records.

**Sarah Beth Strickland Missing**: No import-lead call was ever made for her -- no intake_events or edge function logs exist. This is a Gmail script issue (the email was never forwarded to the edge function), not an app bug. No code change needed, but you may need to re-trigger or manually add her.

**Questionnaire Section Placement**: Move it to the top of the Pipeline page.

**Create Links Without a Booking**: Add a "Quick Add" button to PastBookingQuestionnaires that lets staff create a questionnaire link by typing a name and date, without needing a shift recap or intros_booked record first.

---

## Changes

### 1. SQL Data Fix (again)
- Delete the empty duplicate `b244fea9` (linked to Chloe's booking, status "sent", no responses)
- Update the completed record `cb04c3d8` to set `booking_id = 'ec87d3f8-8823-4e9a-acc9-fd0b1c52aced'`
- Also link Abbie Randol and Lydia Guyse orphaned questionnaires to their bookings if matches exist

### 2. Pipeline.tsx -- Move questionnaire section to top
Reorder the three components so PastBookingQuestionnaires renders first, before ClientJourneyReadOnly.

### 3. PastBookingQuestionnaires.tsx -- Fix fallback logic + Add Quick-Create
**Fix**: When building the questionnaire map, if a booking_id match exists but has no responses (status not "completed"), check the name-based map for a completed record and prefer it.

**Quick-Create**: Add a "Quick Add" button at the top of the section. Clicking it shows a small inline form with:
- Client name (text input)
- Intro date (date input)
- Intro time (optional time input)

On submit, create an `intro_questionnaires` record (no booking_id needed) with a generated slug, and show the copyable link immediately. This creates a standalone questionnaire link that the name-based fallback will automatically link to a booking later when one is created.

---

## File Summary

| Action | File |
|--------|------|
| SQL | Delete empty duplicate, link completed record to booking, fix other orphans |
| Edit | `src/pages/Pipeline.tsx` -- reorder: PastBookingQuestionnaires first |
| Edit | `src/components/PastBookingQuestionnaires.tsx` -- fix completed-record preference in fallback, add Quick Add form |
