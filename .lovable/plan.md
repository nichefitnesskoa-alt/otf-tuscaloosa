
# Fix: Dashboard vs Meeting Close Rate Mismatch

## Root Cause

The Studio Scoreboard (dashboard) and Team Meeting agenda calculate "showed" differently, leading to different close rates even with the same sales count:

**Dashboard** (`useDashboardMetrics.ts`):
- Only counts runs linked to **1st intro bookings** (or unlinked runs)
- Groups runs by booking to deduplicate (one "showed" per booking)
- Uses `isMembershipSale()` for sale detection

**Meeting** (`useMeetingAgenda.ts`):
- Counts **ALL** non-no-show runs with run_date in range -- including runs linked to 2nd intros, excluded bookings, etc.
- No deduplication by booking
- Uses `isPurchased()` for sale detection (slightly different function, though not causing issues today)

Since the meeting includes more "showed" entries in the denominator (2nd intros, etc.), the close rate is lower: same sales / more showed = lower %.

## Fix

Update `useMeetingAgenda.ts` to match the dashboard's logic:

1. **Filter runs to first-intro bookings only**: After fetching runs, filter out any run linked to a booking that has an `originating_booking_id` (i.e., a 2nd intro booking). Unlinked runs remain counted.

2. **Deduplicate by booking**: Group linked runs by `linked_intro_booked_id` and count one "showed" per booking, same as the dashboard.

3. **Standardize sale detection**: Replace `isPurchased()` with `isMembershipSale()` in `isSaleInStrRange()` so both views use the exact same definition of a sale.

## Files to Modify

- `src/hooks/useMeetingAgenda.ts`
  - In the metrics computation section (~lines 297-318):
    - Build a set of first-intro booking IDs from `filteredBooked`
    - Filter `runs` to only include those linked to first-intro bookings (or unlinked)
    - Group by booking for deduplication when counting "showed"
  - In `isSaleInStrRange()` (~line 122): replace `isPurchased()` with `isMembershipSale()`

## Technical Details

The dashboard correctly restricts its funnel to first-intro bookings because 2nd intros are follow-up visits for the same prospect and should not inflate the "showed" denominator. The meeting agenda was built separately and missed this filtering step. After this fix, both views will use identical logic for showed/sales/close-rate.
