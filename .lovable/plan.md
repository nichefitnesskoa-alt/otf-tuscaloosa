

# Fix: Action Buttons Should Perform Specific Actions, Not Trigger Reflections

## Problem
The right-side action buttons ("Copy Q Link", "Open Prep Card", "Send Confirmation", "Go to Follow-Ups", "Go to New Leads", "+ Add Lead") currently trigger the same reflection bottom sheet as the left-side circle tap. The intended UX:
- **Left circle** = mark complete / open reflection sheet
- **Right button** = perform the specific action described by the label

## Current Code Issue
In `WinTheDay.tsx`, `handleAction` (lines 84-91) is identical to `handleCircleTap` — both open the reflection drawer for influenced types. The action button needs its own handler that performs the described action instead.

## Changes — `src/features/myDay/WinTheDay.tsx`

### Replace `handleAction` with action-specific logic

| Item Type | Action Label | What the button should do |
|-----------|-------------|--------------------------|
| `q_send` | Copy Q Link | Copy `item.questionnaireLink` to clipboard, toast confirmation |
| `q_resend` | Resend Script | Open script picker sheet or copy link |
| `prep_roleplay` | Open Prep Card | Navigate to prep card (already works via `handleDirectComplete`) |
| `confirm_tomorrow` | Send Confirmation | Open script picker for confirmation scripts (via `onSwitchTab` or existing script sheet) |
| `followups_due` | Go to Follow-Ups | Call `onSwitchTab('followups')` |
| `leads_overdue` | Go to New Leads | Call `onSwitchTab('newleads')` |
| `log_ig` | + Add Lead | Call `onSwitchTab('igdm')` (already works) |
| `shift_recap` | End Shift | Trigger end-shift button (already works) |

The new `handleAction` will:
1. For `q_send`: copy the questionnaire link to clipboard and show a toast
2. For `q_resend`: copy questionnaire link to clipboard
3. For `prep_roleplay`: open the prep card (same as current `handleDirectComplete`)
4. For `confirm_tomorrow`: open the scripts sheet for confirmation, or navigate to the intro card
5. For `followups_due`: `onSwitchTab('followups')`
6. For `leads_overdue`: `onSwitchTab('newleads')`
7. For `log_ig`: `onSwitchTab('igdm')`
8. For `shift_recap`: trigger the end-shift FAB

The left-side circle tap (`handleCircleTap`) remains unchanged — it opens reflections for influenced types and direct-completes SA-controlled types.

## Files Changed

| File | Change |
|------|--------|
| `src/features/myDay/WinTheDay.tsx` | Rewrite `handleAction` to perform action-specific behavior per item type instead of mirroring `handleCircleTap` |

