

## Plan: Auto-Close Indicator, 2nd Intro Owner Fix, and Inline Owner Edit Fix

### 1. Add auto-close visual indicator on shift recaps

**Files**: `src/components/admin/ShiftRecapsEditor.tsx`, `src/components/admin/ShiftRecapDetails.tsx`

- In `ShiftRecapsEditor.tsx`, add a badge next to the shift type when `shift_type === 'Auto-closed'` or when `other_info` contains "Auto-submitted". Show an amber/yellow badge: "Auto-closed".
- Also show the badge inline in the table row and in the detail view.
- In `ShiftRecapDetails.tsx`, add a banner at the top if the recap was auto-closed.

Additionally, update the `CloseOutShift.tsx` summary dialog: when viewing a recap that was auto-submitted, show a note like "This recap was auto-submitted at 7:00 PM".

### 2. Fix 2nd intro owner attribution

**Root cause**: When a 2nd intro booking is created in `PipelineDialogs.tsx` (line 806), `intro_owner` is not set. Then when the run is created via `applyIntroOutcomeUpdate`, the owner defaults to `params.editedBy` (the SA logging the outcome) instead of the original booking's owner.

**Fix in `PipelineDialogs.tsx`** (line 806-822):
- When inserting the 2nd intro booking, also set `intro_owner: first.intro_owner` and `intro_owner_locked: true` to inherit from the original booking.

**Fix in `applyIntroOutcomeUpdate.ts`** (lines 112-124):
- When creating a run for a booking that has `originating_booking_id` (2nd intro), fetch the original booking's `intro_owner` and use that as the resolved owner instead of `params.editedBy`.
- This ensures 2nd intro runs always inherit attribution from the first intro's owner.

**Data remediation**: Write a one-time SQL migration to fix existing 2nd intro bookings:
```sql
UPDATE intros_booked b2
SET intro_owner = b1.intro_owner
FROM intros_booked b1
WHERE b2.originating_booking_id = b1.id
  AND b1.intro_owner IS NOT NULL
  AND (b2.intro_owner IS NULL OR b2.intro_owner != b1.intro_owner);
```
Also fix the corresponding `intros_run` records linked to those 2nd intro bookings.

### 3. Fix inline owner dropdown not saving

**Root cause**: The `IntroCard` `InlineSelect` component (lines 86-108) writes to `intros_booked` using `[field]: val`. However, the `intro_owner` field is not currently exposed as an inline-editable field in IntroCard (only `coach_name` and `lead_source` are). The user is likely using the Pipeline "Set Intro Owner" dialog which does save correctly but the UI doesn't refresh the journey list because `onRefresh` may not trigger a full re-render of the row.

**Investigation needed**: The Pipeline "Set Intro Owner" dialog (line 428-434) does call `withSave` which calls `onRefresh`. If the dropdown value isn't visually updating, it could be a stale state issue with `newIntroOwner` not being initialized when the dialog opens.

**Fix in `PipelineDialogs.tsx`**: Initialize `newIntroOwner` from `booking.intro_owner` when the `set_owner` dialog opens. Currently `newIntroOwner` starts as `''` (line 74) and is never pre-populated when the dialog opens, so the Select shows empty and selecting a value should work — but the value might be sent as empty on first render. Add initialization logic when `type === 'set_owner'`.

### Summary of file changes

| File | Change |
|------|--------|
| `src/components/admin/ShiftRecapsEditor.tsx` | Add "Auto-closed" badge in table rows |
| `src/components/admin/ShiftRecapDetails.tsx` | Add auto-close banner at top |
| `src/features/pipeline/components/PipelineDialogs.tsx` | Set `intro_owner` on 2nd intro booking creation; initialize owner dialog state |
| `src/lib/domain/outcomes/applyIntroOutcomeUpdate.ts` | Inherit owner from original booking for 2nd intros |
| SQL migration | Remediate existing 2nd intro owner mismatches |

