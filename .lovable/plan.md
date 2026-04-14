

## Fix: VIP Group Archiving

### Root Cause
The group dropdown is built from two sources: `intros_booked.vip_class_name` and `vip_sessions.reserved_by_group`. When you click "Archive" on a group like "Miss Alabama," it tries to update `vip_sessions` rows — but none exist for that group. So the archive silently does nothing and the group stays in the dropdown.

### Plan

**1. Fix archive logic to handle groups with no session record**
In `handleDeleteGroup`, after the existing update calls, check if any rows were actually archived. If not (no `vip_sessions` record exists), **insert** a new `vip_sessions` row with `vip_class_name` set to the group name and `archived_at` set to now. This ensures every archived group has a trackable record.

**2. Fix unarchive to work the same way**
`handleUnarchiveGroup` already updates by name, so it will work once the record exists from step 1.

**3. Verify dropdown filtering**
The existing filter `groups.filter(g => showArchived || !archivedGroups.has(g))` is correct — it just never had data to filter because no archive record was being created.

### Files Changed
- `src/features/pipeline/components/VipPipelineTable.tsx` — update `handleDeleteGroup` to insert a `vip_sessions` row when none exists for the group being archived.

