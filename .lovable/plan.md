

## Plan: Fix Duplicate Persistence + Add Delete Option to Intro Cards

### Root Cause

Two issues found:

1. **Sofia Degl'Innocenti appears twice** because there are two separate `intros_booked` rows — one from "System (Auto-Import)" with a real apostrophe (`'`), and one from "System (Sheet Import)" with an HTML-encoded apostrophe (`&#x27;`). Both have `deleted_at = null` and `booking_status_canon = ACTIVE`. There is no delete function available, so the user had no way to remove either.

2. **No delete option exists** on any My Day card. The Edit dialog only allows changing coach, time, source, owner, and booker. There is no soft-delete action anywhere in the IntroRowCard or EditBookingDialog.

### Changes

**1. Data repair — soft-delete the duplicate row**

Run a migration to soft-delete the HTML-encoded duplicate (`id = 1b0312a6-bb7b-4734-9886-9d7f7d6d67f8`, the Sheet Import copy):

```sql
UPDATE intros_booked
SET deleted_at = now(),
    booking_status_canon = 'DELETED_SOFT',
    booking_status = 'Deleted (soft)',
    last_edited_by = 'System (data repair)',
    last_edited_at = now(),
    edit_reason = 'Duplicate: HTML-encoded apostrophe variant of same booking'
WHERE id = '1b0312a6-bb7b-4734-9886-9d7f7d6d67f8';
```

**2. Add "Delete Booking" button to EditBookingDialog**

File: `src/components/myday/EditBookingDialog.tsx`

- Add a red "Delete Booking" button at the bottom of the dialog (below Save, visually separated)
- On click, show a confirmation AlertDialog: "Delete {memberName}? This will remove the booking from all views. This cannot be undone."
- On confirm: soft-delete the booking (`deleted_at = now()`, `booking_status_canon = 'DELETED_SOFT'`, `booking_status = 'Deleted (soft)'`)
- Also delete any linked `follow_up_queue` rows for that booking
- Call `onSaved()` to refresh the list
- Requires adding `memberName` prop to EditBookingDialog

**3. Pass `memberName` through to EditBookingDialog**

File: `src/features/myDay/IntroRowCard.tsx`

- Add `memberName={item.memberName}` prop to the existing `<EditBookingDialog>` usage (line ~689)

### Files changed
1. Database migration — soft-delete duplicate row
2. `src/components/myday/EditBookingDialog.tsx` — add delete button + confirmation
3. `src/features/myDay/IntroRowCard.tsx` — pass memberName prop

