

# Add "Resend Questionnaire" Option and Keep Booking Entry After Reschedule/2nd Intro

## Changes

### 1. Add "Resend Questionnaire" option to ClientActionDialog
When selecting an existing client from autocomplete, a third button appears: **"Resend Questionnaire"**. This pulls the existing client's info into the booking entry form (name, date, time, lead source) but specifically to access/generate/copy the questionnaire link -- without creating a new booking or modifying the existing one.

### 2. Stop clearing the form after Reschedule or 2nd Intro
Currently, after a successful reschedule, the booking entry fields are wiped clean (`memberName: '', introDate: '', ...`). After a 2nd intro selection, the dialog closes but the form stays populated (this already works). 

The fix: After **reschedule**, instead of clearing the form, populate it with the updated client info (new date/time) so the questionnaire link section appears and the SA can generate/copy the link.

### 3. "Resend Questionnaire" flow
When the SA picks "Resend Questionnaire":
- Populate the booking entry with the client's existing name, date, time, lead source
- Check if a questionnaire already exists for that booking (via `intro_questionnaires.booking_id`)
- If yes, load the existing questionnaire ID and status so the link/copy/status badge appears
- If no, the `QuestionnaireLink` component auto-generates one as usual
- The SA can then copy the link and send it

## Technical Details

### File: `src/components/ClientActionDialog.tsx`
- Add a third button: "Resend Questionnaire" with a `FileText` icon
- Description: "Get the pre-intro questionnaire link for this client"
- Add `onResendQuestionnaire` callback prop

### File: `src/components/IntroBookingEntry.tsx`
- Add `handleChooseResendQuestionnaire` callback that:
  - Closes the action dialog
  - Populates the form with the client's existing info (name, date, time, lead source)
  - Looks up any existing `intro_questionnaires` record by `booking_id` matching the selected client's ID
  - If found, sets `questionnaireId` and `questionnaireStatus` on the booking entry
  - Sets `dismissedWarning = true` to suppress the duplicate warning
- Modify `handleRescheduleSuccess`:
  - Instead of clearing all fields, populate them with the rescheduled client's updated info (new date/time from the reschedule dialog)
  - This keeps the entry visible so the questionnaire link appears
- Pass `onResendQuestionnaire` to `ClientActionDialog`

### File: `src/components/RescheduleClientDialog.tsx`
- Change `onSuccess` to pass back the updated date/time so `IntroBookingEntry` can populate the form instead of clearing it
- Update the callback type to: `onSuccess: (updatedData: { date: string; time: string }) => void`

