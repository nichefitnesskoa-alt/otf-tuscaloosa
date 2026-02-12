

# Rename "Lost" to "Do Not Contact" + Add "Purchased" Stage + Delete Leads

## Overview
Rename the "Lost" stage label to "Do Not Contact" everywhere in the UI, add a "Purchased" (`won`) stage, and add the ability to delete leads with confirmation.

## Changes

### 1. Rename "Lost" to "Do Not Contact" (UI labels only, DB value stays `lost`)

**Files affected:**
- `LeadKanbanBoard.tsx` -- Column label "Lost" becomes "Do Not Contact"
- `LeadListView.tsx` -- Stage dropdown option "Lost" becomes "Do Not Contact"
- `LeadDetailSheet.tsx` -- Stage badge displays "Do Not Contact" for `lost`, button text "Lost" becomes "Do Not Contact"
- `MarkLostDialog.tsx` -- Title becomes "Mark as Do Not Contact", button text updated
- `LeadMetricsBar.tsx` -- Metric label "Lost" becomes "DNC" (short form to fit the card)
- `LeadCard.tsx` -- No text label changes needed (uses opacity styling)

### 2. Add "Purchased" (`won`) stage

- **`LeadKanbanBoard.tsx`** -- Add 4th column: "Purchased" with amber styling (`bg-amber-500/10 border-amber-500/30`)
- **`LeadListView.tsx`** -- Add "Purchased" option to stage dropdown
- **`LeadDetailSheet.tsx`** -- Add stage color for `won`, add "Mark Purchased" button (amber) that sets `stage = 'won'`
- **`Leads.tsx` (`handleStageChange`)** -- Handle `won` stage directly (no reason dialog needed)

### 3. Delete Lead capability

- **`LeadDetailSheet.tsx`** -- Add a red "Delete Lead" button at the bottom of the detail view with an `AlertDialog` confirmation
- On confirm: delete from `lead_activities` first (FK dependency), then delete from `leads`
- Close the sheet and refresh the list after deletion

## Technical Details

### `LeadKanbanBoard.tsx`
- Update COLUMNS array: rename "Lost" label to "Do Not Contact", add `{ stage: 'won', label: 'Purchased', color: 'bg-amber-500/10 border-amber-500/30' }`

### `LeadListView.tsx`
- Stage dropdown: rename "Lost" to "Do Not Contact", add "Purchased" with value `won`

### `LeadDetailSheet.tsx`
- Add `won: 'bg-amber-500 text-white'` to STAGE_COLORS
- Rename `lost` display in badge to "Do Not Contact"
- Add stage label mapping for badge display
- Add "Mark Purchased" button alongside existing actions
- Add delete button with AlertDialog import and confirmation flow
- Delete logic: `supabase.from('lead_activities').delete().eq('lead_id', id)` then `supabase.from('leads').delete().eq('id', id)`

### `MarkLostDialog.tsx`
- Dialog title: "Mark as Do Not Contact"
- Button text: "Mark as Do Not Contact"

### `LeadMetricsBar.tsx`
- Label "Lost" becomes "DNC"

### `Leads.tsx`
- In `handleStageChange`: allow `won` to pass through without triggering the lost-reason dialog

