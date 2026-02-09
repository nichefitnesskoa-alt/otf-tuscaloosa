

# Add Coach Field to Edit Intros Run + Clear Option for Bookings

## Problem

1. **Edit Run Dialog**: When editing an intro run in Admin > Client Journey View, there's no coach field - so you cannot add or change the coach for an intro that was run.

2. **Edit Booking Dialog**: While there IS a coach selector, there's no option to clear/reset it to "TBD" if you made a mistake picking someone for a future intro.

## Solution

### Part 1: Add Coach Field to Edit Run Dialog

Update the `ClientJourneyPanel.tsx` to:
1. Add `coach_name` to the `ClientRun` interface
2. Include `coach_name` in the data fetch query for `intros_run`
3. Add a Coach selector field to the Edit Run Dialog
4. Include `coach_name` in the `handleSaveRun` function when updating the database
5. When coach is updated on a run, also sync it to the linked booking (if applicable)

### Part 2: Add "TBD/Clear" Option to Coach Selectors

Update both Edit Booking and Edit Run dialogs to include a special "TBD" option that allows clearing/resetting the coach.

---

## Technical Changes

### File: `src/components/admin/ClientJourneyPanel.tsx`

**1. Update `ClientRun` interface (line 118-138):**
Add `coach_name` field to track which coach ran the intro.

**2. Update data fetch query (line 265-266):**
Add `coach_name` to the select statement for `intros_run`.

**3. Update Edit Run Dialog (after line 1873, before Lead Measures):**
Add a Coach selector with options for all coaches + a "TBD" option.

**4. Update `handleSaveRun` function (line 1057-1107):**
- Include `coach_name` in the update
- When coach is changed and run is linked to a booking, sync the coach to the booking

**5. Update Edit Booking Dialog coach selector (line 1741-1752):**
Add a "TBD" option at the top of the coach list.

---

## UI Changes

### Edit Run Dialog - Add Coach Field

```text
Before:                           After:
┌────────────────────────┐       ┌────────────────────────┐
│ Member Name            │       │ Member Name            │
│ Run Date | Time        │       │ Run Date | Time        │
│ Ran By                 │       │ Ran By                 │
│ Lead Source            │       │ Lead Source            │
│ Result/Outcome         │       │ Coach  ← NEW FIELD     │
│ ─────────────────────  │       │ Result/Outcome         │
│ Lead Measures...       │       │ ─────────────────────  │
└────────────────────────┘       │ Lead Measures...       │
                                 └────────────────────────┘
```

### Edit Booking Dialog - Coach Field

```text
Before:                           After:
┌────────────────────────┐       ┌────────────────────────┐
│ Coach                  │       │ Coach                  │
│ [Select coach...    ▼] │       │ [Select coach...    ▼] │
│ ├─ Bre                 │       │ ├─ — TBD/Unknown —     │ ← NEW
│ ├─ Elizabeth           │       │ ├─ Bre                 │
│ └─ James, etc.         │       │ ├─ Elizabeth           │
└────────────────────────┘       │ └─ James, etc.         │
                                 └────────────────────────┘
```

---

## Data Flow for Coach Sync

When editing a run's coach and saving:

```text
Edit Run → Save → Update intros_run.coach_name
                        ↓
                Is run linked to a booking?
                        ↓
                      YES → Update intros_booked.coach_name too
```

This ensures the coach is consistent between the run and its linked booking.

---

## Summary

| Change | Location |
|--------|----------|
| Add `coach_name` to `ClientRun` interface | Line 118-138 |
| Add `coach_name` to fetch query | Line 265-266 |
| Add Coach selector to Edit Run Dialog | After line 1873 |
| Include `coach_name` in `handleSaveRun` | Line 1064-1089 |
| Sync coach to linked booking on save | After line 1094 |
| Add "TBD" option to Booking coach selector | Line 1741-1752 |

