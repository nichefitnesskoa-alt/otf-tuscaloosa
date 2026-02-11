

# Add "Create Text" to Client Pipeline

## Overview
Add a "Create Text" button to each client in the Client Pipeline (ClientJourneyReadOnly). Tapping it opens the existing MessageGenerator flow with scripts pre-filtered based on the client's journey status (upcoming, no-show, post-class, etc.) and merge fields auto-filled from their booking data.

---

## How It Works

1. Each client row in the pipeline gets a small message icon button (visible without expanding).
2. Tapping it opens a ScriptPickerSheet with scripts filtered by that client's status:
   - **Upcoming booking**: Booking Confirmation + Pre-Class Reminder scripts
   - **Today's class**: Pre-Class Reminder scripts
   - **No-show**: No-Show sequence (auto-detects next step)
   - **Missed guest / Post-class no sale**: Post-Class (Didn't Close) variants
   - **Not interested**: Cold Lead Re-Engagement scripts
   - **Active (general)**: All relevant scripts
3. Merge fields auto-fill from the booking data: `{first-name}`, `{last-name}`, `{day}`, `{time}`, `{sa-name}`, `{questionnaire-link}`.
4. After selecting a script, the normal MessageGenerator flow handles preview, edit, copy, and log.

---

## Technical Details

### File: `src/components/dashboard/ClientJourneyReadOnly.tsx`

- Import `ScriptPickerSheet` and `MessageGenerator` from the scripts components, plus `useAuth` and `useScriptSendLog`.
- Add state for `scriptTarget` (the selected journey) and `selectedTemplate`.
- Add a `MessageSquare` icon button on each client row (next to the status badge). Uses `e.stopPropagation()` to avoid toggling the collapsible.
- When tapped, determine suggested script categories from the journey status:

```text
status = 'no_show'       -> ['no_show']
status = 'active' + upcoming booking -> ['booking_confirmation', 'pre_class_reminder']
status = 'active' + today booking -> ['pre_class_reminder']
status = 'active' + past booking -> ['post_class_no_close']
status = 'not_interested' -> ['cold_lead']
default -> all categories
```

- Build merge context from the journey's latest booking: parse `member_name` into first/last, pull `class_date`/`intro_time` for `{day}` and `{time}`, fetch questionnaire slug if available.
- Open a dialog showing recommended scripts (filtered by suggested categories) at top, with "All Scripts" below using category tabs.
- Selecting a script opens MessageGenerator with the pre-filled context and the booking ID for logging.

### New Component: `src/components/dashboard/PipelineScriptPicker.tsx`

A small wrapper component specific to the pipeline that:
- Accepts a `ClientJourney` object
- Determines suggested categories
- Builds merge context (including async questionnaire-link lookup)
- Renders a dialog with recommended + all scripts
- Hands off to MessageGenerator on selection

This keeps `ClientJourneyReadOnly` clean by encapsulating the script logic.

---

## File Summary

| Action | File |
|--------|------|
| Create | `src/components/dashboard/PipelineScriptPicker.tsx` -- script picker dialog for pipeline clients |
| Edit | `src/components/dashboard/ClientJourneyReadOnly.tsx` -- add MessageSquare button per client row, wire up PipelineScriptPicker |

