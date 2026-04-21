
## Goal

Fix the real root cause behind the “stuck” inline dropdowns on regular My Day intro cards so coach and lead source can actually change again, and fix every other inline header editor that shares the same bug.

## Root cause

The problem is not the dropdown component itself.

The broken behavior comes from the shared editable card header in `src/components/shared/IntroCard.tsx`:

- `InlineSelect`
- `InlineTimePicker`
- `InlineDatePicker`
- `InlineText`

These controls save directly to the database, but they do **not**:
1. update any local display state after a change, or
2. call `onFieldSaved()` after a successful save.

Because each control is rendered from the old prop value, the UI immediately falls back to the stale value and looks “stuck” even when the interaction fired.

That same shared bug affects:
- coach dropdown
- lead source dropdown
- inline class time
- inline class date
- inline phone text edit

on any My Day card using `IntroCard` in editable mode.

## Files affected

### `src/components/shared/IntroCard.tsx`
Fix the shared inline editor primitives at the source.

### `src/features/myDay/IntroRowCard.tsx`
No behavior redesign needed, but this card will immediately benefit because it already passes:
- `editable={true}`
- `editedBy={userName}`
- `onFieldSaved={onRefresh}`

## Implementation

### 1) Fix `InlineSelect`
Update it so a successful selection does all three:
- saves to `intros_booked`
- updates its displayed value locally right away
- calls `onSaved()` after success so parent data refreshes

Behavior:
- optimistic local value updates on selection
- if save fails, revert to previous value and show existing error toast
- if save succeeds, keep the new value visible and trigger parent refresh

This directly fixes:
- coach dropdown
- lead source dropdown

### 2) Fix `InlineTimePicker`
Apply the same pattern:
- keep local selected time state
- update visible value immediately
- call `onSaved()` after successful save
- revert on failure

This fixes the inline time control before it causes the same “stuck” behavior.

### 3) Fix `InlineDatePicker`
Apply the same pattern:
- keep local date state
- reflect chosen date immediately
- call `onSaved()` after successful save
- revert on failure

### 4) Fix `InlineText`
After successful blur-save:
- keep the latest visible value
- call `onSaved()` so My Day refreshes cleanly

This fixes the same stale-prop issue for inline phone editing.

### 5) Preserve existing styling and layout
Do not redesign the card header UI.
Only repair save/state flow inside the shared inline editor primitives.

## Expected result after fix

On regular My Day cards:
- changing coach works immediately
- changing lead source works immediately
- changing date/time/phone no longer snaps back
- saved values remain visible without feeling frozen
- parent card data still refreshes through existing `onRefresh`

## Downstream effects implemented

- Root cause fixed in the shared editable header component, not patched only for one dropdown
- All inline editable header fields on My Day cards fixed together
- No database schema changes
- No role/RLS changes
- No changes to VIP notifications, VIP group sheet layout, Outcome Drawer, or any unrelated page
- No visual styling changes outside the specific broken inline editor behavior
