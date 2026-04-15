

## Plan: Align Coach View Filtering with My Day

### Root Cause

The Coach View query (`src/pages/CoachView.tsx` lines 103-109) fetches bookings with only two exclusions:
- `deleted_at IS NULL`
- `booking_status_canon != 'DELETED_SOFT'`

My Day (`useUpcomingIntrosData.ts`) excludes `CANCELLED`, `PLANNING_RESCHEDULE`, `DELETED_SOFT`, and `VIP`/`COMP` booking types.

The Coach View's client-side filter (line 143) only removes `is_vip` and `deleted_at`. It does **not** exclude `CANCELLED`, `PLANNING_RESCHEDULE`, `NOT_INTERESTED`, or `CLOSED_PURCHASED` statuses. This means resolved/cancelled/rescheduled members still appear on the Coach side but not on My Day.

### Fix

**File: `src/pages/CoachView.tsx`**

1. Update the Supabase query (line 103-109) to exclude the same statuses My Day excludes:
   - Add `.not('booking_status_canon', 'in', '("CANCELLED","PLANNING_RESCHEDULE","DELETED_SOFT")')` 
   - Add `.not('booking_type_canon', 'in', '("VIP","COMP")')` to move VIP exclusion to the query level

2. Update the client-side `filteredBookings` filter (line 143) to also exclude these statuses as a safety net, replacing the simple `!b.is_vip` check with a proper status exclusion list matching My Day's logic.

### Result
Coach View will show exactly the same set of intros as My Day for the same date range. Resolved, cancelled, and rescheduled bookings will no longer appear on the Coach side.

### One file changed
- `src/pages/CoachView.tsx`

