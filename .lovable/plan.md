

# VIP List: Delete Members + Clarify VIP ≠ Intros

## Changes

### 1. Add Delete button to VIP Pipeline table rows

**File: `src/features/pipeline/components/VipPipelineTable.tsx`**

- Add a delete (trash) button in the Actions column for each VIP row
- On click, soft-delete the booking record (`deleted_at = now()`, `deleted_by = user`) and also delete the linked `vip_registrations` record
- Show a confirmation toast with the member name
- Refresh the table after deletion
- Add a "Delete Selected" bulk action button in the bulk action bar (next to "Assign to Session") for deleting multiple VIP members at once

### 2. Add Delete button to expanded row detail

In the expanded row section, add a red "Remove from VIP List" button that performs the same delete action with a brief confirmation step.

### 3. VIP bookings excluded from intro counts (verification)

VIP bookings are already excluded from MyDay, shift recap intro counts, and follow-up queues via `booking_type_canon = 'VIP'` filtering. No additional code changes needed -- the existing isolation is correct. VIP sessions are marketing events, not intro appointments.

## Technical Details

**Delete logic** (single member):
```typescript
// Soft-delete the intros_booked record
await supabase.from('intros_booked')
  .update({ deleted_at: new Date().toISOString(), deleted_by: userName })
  .eq('id', bookingId);

// Hard-delete the vip_registrations record (if linked)
await supabase.from('vip_registrations')
  .delete()
  .eq('booking_id', bookingId);
```

**Bulk delete**: Same logic in a loop or `.in('id', selectedIds)` for the bookings, then matching registration cleanup.

**Files modified:**
- `src/features/pipeline/components/VipPipelineTable.tsx` -- add delete button in actions column, bulk delete in toolbar, delete in expanded row

No database schema changes needed. Existing `deleted_at` and `deleted_by` columns on `intros_booked` handle soft deletes. The VIP table query already filters `.is('deleted_at', null)`.

