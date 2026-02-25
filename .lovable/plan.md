

# Add Edge-Case Options to Reflection Bottom Sheets

All four reflection drawers currently have only 3 options each. Adding additional options to cover real-world edge cases SAs encounter.

## Changes — `src/features/myDay/WinTheDay.tsx`

### 1. Questionnaire Reflection (lines 287-309)
Add two new options after the existing three:
- **"Already completed the Q"** (`already_done`) — member filled it out before the SA reached out
- **"Cancelled / not coming"** (`cancelled`) — member cancelled their intro

Update `handleQReflection` type union to accept the new values.

### 2. Confirmation Reflection (lines 320-342)
Add two new options:
- **"Wants to reschedule"** (`reschedule`) — confirmed they're not coming but wants a new date
- **"Cancelled — not coming"** (`cancelled`) — cancelled entirely

Update `handleConfirmReflection` type union.

### 3. New Leads Reflection (lines 390-412)
Add one new option:
- **"No new leads today"** (`none_assigned`) — there were no leads to contact

Update `handleLeadsReflection` type union.

### 4. Follow-Ups Reflection (lines 353-379)
Add a "No follow-ups due" quick-complete button for days when the count is zero but the task still appears.

### Handler Updates
- `handleQReflection`: expand accepted union type to `'answered' | 'sent_waiting' | 'unreachable' | 'already_done' | 'cancelled'`
- `handleConfirmReflection`: expand to `'confirmed' | 'sent_no_response' | 'unreachable' | 'reschedule' | 'cancelled'`
- `handleLeadsReflection`: expand to `'all_contacted' | 'partial' | 'no_time' | 'none_assigned'`

No database changes needed — the `result` column in `win_the_day_reflections` is a text field that accepts any string.

## Files Changed

| File | Change |
|------|--------|
| `src/features/myDay/WinTheDay.tsx` | Add edge-case options to all four reflection drawers, expand handler type unions |

