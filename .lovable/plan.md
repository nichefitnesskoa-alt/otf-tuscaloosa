

# Q Hub Simplification, Script Bug Fixes, and Shift Activity Autosave

## Summary

Five interconnected changes to improve consistency, fix bugs, and reduce friction.

---

## Change 1: Simplify Q Hub Tabs

Replace the current 6-tab layout (Needs Sending / Sent / Completed / Didn't Buy / Not Interested / Purchased) with a cleaner structure:

**Top row (2 tabs):** Not Completed | Completed

**Bottom row (3 tabs):** Didn't Buy | Not Interested | Purchased

"Not Completed" merges the old "Needs Sending" and "Sent" tabs into one list. Cards within it still show their individual status (needs sending vs sent) via the colored banner, so no information is lost.

**File:** `src/components/dashboard/QuestionnaireHub.tsx`
- Merge `needsSending` and `sent` arrays into a single `notCompleted` list
- Update TabsList from 3+3 grid to 2-col top row + 3-col bottom row
- Default tab becomes `not-completed`
- All card rendering, banners, and action buttons remain unchanged

---

## Change 2: Fix Questionnaire Not Appearing in Scripts

**Root cause:** When a booking has no linked questionnaire record (auto-creation failed or link missing), the ScriptPickerSheet query on line 93 returns null, so no Q link gets injected into the script.

**Fix in `src/components/scripts/ScriptPickerSheet.tsx`:**
- After the primary query by `booking_id` returns no result, add a fallback query that searches `intro_questionnaires` by matching name (client_first_name + client_last_name = member_name from the booking)
- If a match is found, auto-link it by updating `booking_id` on the questionnaire record (fire-and-forget, same pattern as the Q Hub auto-linker)
- This ensures the Q link resolves even when the booking_id relationship was never established

This is the same auto-link logic already in QuestionnaireHub (lines 140-165) but applied at the moment scripts are opened, so it catches any records that slipped through.

---

## Change 3: Stop Auto-Marking Questionnaire as "Sent" on Copy

**Current behavior:** In `MessageGenerator.tsx`, both the "Copy to Clipboard" button (handleCopy) and the "Log as Sent" button (handleLog) auto-update the questionnaire status to 'sent'.

**New behavior:**
- **"Copy to Clipboard"** -- only copies text and logs `script_actions`. Does NOT update questionnaire status.
- **"Log as Sent"** -- this is the explicit user action that marks the questionnaire as sent. Only this button updates questionnaire status.

**Also in `QuestionnaireHub.tsx` `copyLink` function (line 346):** Currently auto-marks status as 'sent' when Q link is copied. Add a separate "Mark as Sent" button on Q Hub cards instead, and remove the auto-status-update from the copy action.

**File changes:**
- `src/components/scripts/MessageGenerator.tsx` -- remove questionnaire status update from `handleCopy`, keep it only in `handleLog`
- `src/components/dashboard/QuestionnaireHub.tsx` -- remove auto-status-update from `copyLink`, add explicit "Log as Sent" button on cards in the Not Completed tab

---

## Change 4: Autosave Calls, Texts, and DMs

Replace the manual "Save" button in the Shift Activity module with automatic saving.

**File:** `src/features/myDay/MyDayShiftSummary.tsx`
- Add a `useEffect` debounce (1.5 seconds after last keystroke) that auto-upserts to `shift_recaps`
- Remove the Save button from the UI
- Show a subtle "Saved" indicator that briefly appears after each autosave
- Keep the existing load-on-shift-type-change behavior
- Skip autosave if all fields are empty (prevent creating empty rows)

---

## Change 5: Align Q Completion Rate Between Hub and Scoreboard

**Why they differ today:**
- **Scoreboard** calculates: completed questionnaires / all 1st intro bookings in date range (includes bookings where Q was never sent)
- **Q Hub** calculates: completed / (sent + completed) only (excludes "needs sending" from denominator)

These are fundamentally different metrics. The Scoreboard denominator is correct for measuring "how well are we completing Qs for our intros." The Hub denominator only measures "of the ones we sent, how many came back."

**Fix:** Align the Q Hub stats banner to use the same formula as the Scoreboard:
- Denominator = all 1st-intro questionnaire records (excluding VIP, excluding 2nd intros, excluding legacy ghost records)
- Numerator = those with status 'completed' or 'submitted'
- Label changes to clarify: "Completion (all 1st intros)" so it's clear what's being measured
- This ensures the number in the Q Hub stats matches the Scoreboard for the same time period

---

## Files Modified

| File | What Changes |
|------|-------------|
| `src/components/dashboard/QuestionnaireHub.tsx` | Tab restructure, remove auto-sent on copy, add "Log as Sent" button, align completion rate formula |
| `src/components/scripts/ScriptPickerSheet.tsx` | Fallback Q lookup by name when booking_id query returns nothing |
| `src/components/scripts/MessageGenerator.tsx` | Remove questionnaire status update from handleCopy |
| `src/features/myDay/MyDayShiftSummary.tsx` | Replace Save button with debounced autosave |

**No files removed. No existing features removed. No database changes needed.**
