

# Fix Friend Script Logging + Auto-Mark Questionnaires as Sent

## Problems

1. **"Log as Sent" doesn't update the friend's questionnaire status** -- When you send a confirmation script containing both questionnaire links, only the main person's questionnaire gets updated. The friend's stays at "Not Sent" because the system doesn't know the friend's link was included in the message.

2. **Auto-complete already works** -- If a client accesses and fills out their questionnaire without it being marked "sent" first, it correctly updates to "completed." The polling in the QuestionnaireLink component already handles this (checks every 10 seconds). No fix needed here.

## Solution

### 1. Auto-mark both questionnaires as "sent" when a script is logged

**File: `src/components/scripts/MessageGenerator.tsx`**

Update the `handleLog` function to detect questionnaire URLs in the sent message body. After successfully logging:
- Check if the message body contains a questionnaire link matching the main person's questionnaire ID or slug
- Check if the message body contains the friend's questionnaire link
- For each match found, update that questionnaire's status from `not_sent` to `sent`

Pass new optional props `questionnaireId`, `friendQuestionnaireId`, and callbacks `onQuestionnaireSent`, `onFriendQuestionnaireSent` through the component chain.

### 2. Thread the questionnaire IDs through ScriptPickerSheet

**File: `src/components/scripts/ScriptPickerSheet.tsx`**

Add optional props: `questionnaireId`, `friendQuestionnaireId`, `onQuestionnaireSent`, `onFriendQuestionnaireSent`. Pass them down to `MessageGenerator`.

### 3. Pass from IntroBookingEntry

**File: `src/components/IntroBookingEntry.tsx`**

Pass `questionnaireId` and `friendQuestionnaireId` to `ScriptPickerSheet`, along with callbacks that update the booking entry's questionnaire statuses to `sent`.

---

## Technical Details

### MessageGenerator.tsx changes

Add props:
```
questionnaireId?: string;
friendQuestionnaireId?: string;
onQuestionnaireSent?: () => void;
onFriendQuestionnaireSent?: () => void;
```

In `handleLog`, after the successful `logSent.mutateAsync` call:
- If `questionnaireId` exists, update its status to `sent` (if currently `not_sent`)
- If `friendQuestionnaireId` exists, update its status to `sent` (if currently `not_sent`)
- Call the corresponding callbacks so the parent UI updates

### ScriptPickerSheet.tsx changes

Add the same 4 optional props and forward them to `MessageGenerator`.

### IntroBookingEntry.tsx changes

Update the `ScriptPickerSheet` usage (line 448-454):
- Pass `questionnaireId={booking.questionnaireId}`
- Pass `friendQuestionnaireId={booking.friendQuestionnaireId}`
- Pass `onQuestionnaireSent` callback that calls `onUpdate(index, { questionnaireStatus: 'sent' })`
- Pass `onFriendQuestionnaireSent` callback that calls `onUpdate(index, { friendQuestionnaireStatus: 'sent' })`

---

## File Summary

| Action | File | What Changes |
|--------|------|-------------|
| Edit | `src/components/scripts/MessageGenerator.tsx` | Add questionnaire ID props, auto-update status to "sent" on log |
| Edit | `src/components/scripts/ScriptPickerSheet.tsx` | Thread new props to MessageGenerator |
| Edit | `src/components/IntroBookingEntry.tsx` | Pass questionnaire IDs and callbacks to ScriptPickerSheet |
