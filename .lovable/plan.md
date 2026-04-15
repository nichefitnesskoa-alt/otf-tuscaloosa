

## Plan: Fix VIP Roster Count Mismatch

### Root Cause

Two bugs cause the roster to show 7 while the admin shows 11:

1. **Missing `vip_session_id` on bulk import**: `VipBulkImport.tsx` (line 165-176) creates `vip_registrations` with `vip_class_name` but never sets `vip_session_id`. The public roster page (`VipRoster.tsx`) queries by `vip_session_id`, so these 4 members are invisible.

2. **Case mismatch**: The 4 missing registrations have `vip_class_name = 'Pjs Coffee'` (lowercase 's') instead of `'PJs Coffee'`. This is a secondary data consistency issue.

### Fix

**1. Data repair — link the 4 orphaned registrations to the correct session**

```sql
UPDATE vip_registrations
SET vip_session_id = 'e5947bbb-abe0-47ef-82de-c2ccc6f6323d',
    vip_class_name = 'PJs Coffee'
WHERE id IN (
  'b9c83e6c-482b-4127-9d4c-894cec2325d9',
  '5a0f3504-7332-42c3-9501-5325edbfea6b',
  '3e5d8384-79b9-42c2-a5fb-dfadfbba060c',
  '1dd6cb0d-6ffe-48ca-b8d0-4c889e2844d0'
);
```

**2. Fix `VipBulkImport.tsx` — set `vip_session_id` on insert**

The bulk import already receives the session context. Add `vip_session_id` to the registration insert so future imports are properly linked and visible on the roster.

**3. Fix `VipGroupDetail.tsx` "Add Member" flow** (if it also creates registrations without `vip_session_id`)

Audit the manual add-member path in VipGroupDetail to ensure it also sets `vip_session_id`.

### Result
- Roster page and admin VIP tab will show the same count
- Future bulk imports will correctly link registrations to sessions
- No other files change

### Files changed
1. Database migration — repair 4 orphaned registrations
2. `src/components/admin/VipBulkImport.tsx` — add `vip_session_id` to registration insert
3. `src/components/admin/VipGroupDetail.tsx` — audit and fix add-member flow if needed

