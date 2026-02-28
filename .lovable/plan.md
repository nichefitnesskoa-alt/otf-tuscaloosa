confirm which specific task is showing the "10 follow-ups" label — is it the follow-up queue task or the cold outreach task? They're different. If it's cold outreach showing incorrectly that's a different fix than what's planned.  
  
Also for fix 5 — contact log tasks like cold texts and DMs should auto-complete based on the actual count logged in script_actions or contact_logs for today, not based on a manual check-off. If the SA has already logged 30 texts today the cold texts task should show as complete automatically without them tapping the circle  
  
Plan: Six Fixes for MyDay

### 1. Remove Action Bar above End Shift + Make End Shift a floating bottom bar

- **MyDayPage.tsx**: Remove the End Shift `<div>` section (lines 311-327) from its current position
- Add a new sticky/fixed bottom bar above the BottomNav that contains the End Shift button, styled as a floating bar with `fixed bottom-20 left-0 right-0 z-30`

### 2. Remove "Submit your shift recap" Win the Day task

- **useWinTheDayItems.ts**: Delete the shift_recap item generation block (lines 370-384) entirely
- **WinTheDay.tsx**: Remove `'shift_recap'` from `DIRECT_COMPLETE_TYPES` array and its case in `handleDirectComplete` and `handleAction`

### 3. Fix Log Outcome task — recognize existing outcomes

- **useWinTheDayItems.ts** (line 280-303): The `log_outcome` task checks `intros_run` for a linked run, but outcomes like "Plans to Reschedule" may store differently. The query uses `linked_intro_booked_id` — need to also check `intros_booked.booking_status_canon` for non-ACTIVE statuses (RESCHEDULED, etc.) to detect already-resolved bookings
- Also add `intros_run` table to the realtime subscription so outcome logging triggers immediate refresh
- Make the circle tappable for `log_outcome` — currently it calls `handleDirectComplete` which just scrolls. Instead, it should navigate to the card AND the task should auto-complete when an outcome exists

### 4. Follow-ups task: only show when there are actually pending follow-ups

- **useWinTheDayItems.ts** (lines 325-336): The follow-ups task shows `fuDueCount` pending items but marks complete based on `followupLogExists` (whether a daily log was submitted). Change logic: if `fuDueCount === 0`, don't add the task at all (already works). The real issue: verify the query is correct — it queries `follow_up_queue` with `status = 'pending'` and `scheduled_date <= today`. If the queue is empty, the task shouldn't appear. The user says there's nothing in the queue but it still shows — likely the follow-up task text says "10 follow-ups" which is from the cold outreach targets being confused. Actually re-reading: the follow-ups task only shows `if (fuDueCount > 0)`. So it shouldn't show if queue is empty. Need to verify no other task is being confused. Possibly the user means cold texts/DMs targets. Will check and ensure follow-ups only appears with actual pending items.

### 5. Auto-detect completion for all Win the Day tasks

- **Questionnaire tasks**: Already check `questionnaire_status_canon`. Good.
- **Prep tasks**: Already check `intro.prepped`. Good.
- **Outcome tasks**: Fix to check `intros_run` AND `booking_status_canon` changes
- **Follow-ups**: Mark complete when `fuDueCount === 0` (all resolved), not just when a log entry exists
- **Confirmations**: Already check `script_actions` for `confirmation_sent`. Good.

### 6. Add Copy Phone button to Script Drawer

- **ScriptPickerSheet.tsx**: Add a "Copy Phone" button next to the existing "Copy questionnaire link" section (around line 347). Fetch phone from the booking record (already available from the booking context fetch). Add phone to the `memberCtx` state and render a copy button.

### Technical Details

**Files to modify:**

1. `src/features/myDay/MyDayPage.tsx` — Move End Shift to floating bottom bar, remove static section
2. `src/features/myDay/useWinTheDayItems.ts` — Remove shift_recap task, fix outcome detection, fix follow-up completion logic
3. `src/features/myDay/WinTheDay.tsx` — Remove shift_recap handling
4. `src/components/scripts/ScriptPickerSheet.tsx` — Add copy phone button, fetch phone from booking