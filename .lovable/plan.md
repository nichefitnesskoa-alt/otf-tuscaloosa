

# Individual Speed-to-Lead + Script Fixes for Leads

## Problem Summary

1. **No per-card speed-to-lead timing** — Lead cards in MyDay don't show when a lead was received or how long it's been waiting
2. **Wrong script categories on Leads tab** — The Script button uses `['speed_to_lead', 'new_lead', 'follow_up']` which don't match any real DB categories (`web_lead`, `ig_dm`, `cold_lead`), so no scripts are suggested
3. **Scripts not all accessible** — When `relevantCategories` is passed to `ClientSearchScriptPicker`, only those categories show in "Recommended", but the "All Scripts" section does work; the issue is the Leads tab `ScriptPickerSheet` uses non-existent categories so nothing matches
4. **No suggested script context per lead** — Script buttons don't pass lead source/stage info to pick the right category automatically

## Changes

### 1. Per-Card Speed-to-Lead + Received Time (`src/features/myDay/MyDayNewLeadsTab.tsx`)

In the `LeadCard` component (line 160-302), add:
- **Received timestamp**: Show actual date/time received below the name, e.g. "Received: Feb 23 at 2:15 PM"
- **Individual speed metric**: For "new" leads, show elapsed time as a prominent line, e.g. "⏱ 2h 34m waiting"
- For "contacted" leads, show response time: "Responded in 45m"

### 2. Fix Script Categories for Leads (`src/features/myDay/MyDayNewLeadsTab.tsx`)

**Line 559**: Change `suggestedCategories` from `['speed_to_lead', 'new_lead', 'follow_up']` to dynamically pick based on the lead's source:
- Instagram leads → `['ig_dm', 'web_lead', 'cold_lead']`
- All other leads → `['web_lead', 'ig_dm', 'cold_lead']`

Also pass `leadId` to `ScriptPickerSheet` so script sends get logged against the lead.

### 3. Add "All" Category Access in ScriptPickerSheet (`src/components/scripts/ScriptPickerSheet.tsx`)

The `ScriptPickerSheet` already has an "All" button (line 227-237), but the `TAB_CATEGORY_MAP` (line 15-20) doesn't include `web_lead` under any tab that would be suggested for leads. 

Add an `outreach` entry to `suggestedCategories` when opened from a lead context, and ensure the "All" tab shows every active script.

### 4. Smart Script Selection Per Lead Card

Update the `onScript` handler to pass lead-specific context so the `ScriptPickerSheet` opens with the right suggested category pre-selected:
- New leads from IG → pre-select `ig_dm`
- New leads from web/other → pre-select `web_lead`
- Contacted leads → pre-select `web_lead` (follow-up touch)
- Booked leads → pre-select `booking_confirmation`

## Files Modified

| File | What Changes |
|------|-------------|
| `src/features/myDay/MyDayNewLeadsTab.tsx` | Add per-card received time + elapsed duration; fix script categories to use real DB values; pass lead source to script picker |
| `src/components/scripts/ScriptPickerSheet.tsx` | No structural changes needed — the existing "All" tab handles showing everything; the fix is in the categories passed in |

## No database changes. No features removed.

