

# Shift Selector Styling Update

## Summary
Restyle the shift selector container in `ShiftChecklist.tsx` to use an orange (#E8540A) background as a call-to-action, update labels, and make the active shift state clearly visible with a white "Change" button.

## File Change: `src/features/myDay/ShiftChecklist.tsx`

### Unselected state (lines 211-230)
- Replace `<Card>` wrapper with a plain `<div>` styled with `bg-[#E8540A]` background, `rounded-xl` border radius, `p-4` padding
- Change label from `"Select your shift"` to `"SELECT YOUR SHIFT — LOADS YOUR RESPONSIBILITIES"` — white, bold, 13px min (`text-[13px] font-bold text-white uppercase tracking-wider`)
- Each shift `<Button>`: keep dark card background (`bg-card`), add `border border-white/20` for subtle white border against orange, keep white text for shift name and time

### Selected state (lines 231-307)
- Replace outer `<Card>` with a `<div>` that has the same `bg-[#E8540A] rounded-xl` container
- Inner content (progress bar, task list) stays inside a nested `<div className="bg-card rounded-lg p-3 space-y-3">` so tasks remain readable on dark background
- Header row: replace current label + badge with a single line in white bold on the orange background: `"{Shift} Shift — Your responsibilities are loaded"` (e.g., "Morning Shift — Your responsibilities are loaded")
- "Change" button: white outlined style — `border border-white text-white hover:bg-white/10` instead of ghost variant
- Progress bar and task list render inside the nested dark card below the orange header

### Visual structure after change

```text
┌─────────────────────────────────┐
│  BG: #E8540A (orange)           │
│  "Morning Shift — Your          │
│   responsibilities are loaded"  │
│                        [Change] │
│  ┌─────────────────────────────┐│
│  │ BG: card (dark)             ││
│  │ Progress bar                ││
│  │ Task list...                ││
│  └─────────────────────────────┘│
└─────────────────────────────────┘
```

## What this does NOT change
- Task list logic, completion, counts — unchanged
- Shift type data, database queries — unchanged
- No other pages or components modified
- ShiftSelector in shiftView is a separate component — not touched
- No changes to ShiftViewPage, MyDayPage, or any other file

## Subsequent changes
- None. This is a styling-only change scoped to the shift selector container within `ShiftChecklist.tsx`

