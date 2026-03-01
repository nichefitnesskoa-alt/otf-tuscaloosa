

## Root Cause

The Studio Scoreboard sales count is computed by summing `perSAData[].sales + unattributedSales`. The perSA logic (line 244 of `useDashboardMetrics.ts`) **only processes runs linked to first-intro bookings** (`firstIntroBookingIds`). Any run linked to a 2nd-intro booking (one with `originating_booking_id`) is silently skipped, so its sale is never counted.

The Conversion Funnel and Sales tab both count ALL membership sales (1st + 2nd intro), which is why they show 10 while the Scoreboard shows 6.

## Fix

Modify the perSA sales counting in `useDashboardMetrics.ts` to also include runs linked to **2nd-intro bookings**. The `introsRun` count should remain first-intro-only (that's the correct denominator for close rate), but **sales** from 2nd-intro runs should be counted and attributed to the original intro owner.

### Implementation Steps

1. **In `useDashboardMetrics.ts` — perSA loop (lines 239-252)**: Add a second map for runs linked to 2nd-intro bookings. Instead of skipping runs whose `linked_intro_booked_id` is not in `firstIntroBookingIds`, check if it's in the full `activeBookings` set and track those sales separately.

2. **Specifically**:
   - Create `activeBookingIds` set from all `activeBookings` (not just first intros)
   - When a run is linked to a booking NOT in `firstIntroBookingIds` but IS in `activeBookingIds`, still check it for `isSaleInRange` and add to `salesCount` (but do NOT add to `introsRunCount` — that stays first-intro-only)

3. **Studio-wide unattributed sales (lines 471-479)**: Apply the same fix — currently unattributed sales also only fire for runs with valid owners, but the booking-link filter should also allow 2nd-intro-linked runs.

4. **Close rate formula stays unchanged**: `Sales / Intros Run` — intros run remains first-intro-only, but sales now includes 2nd-intro conversions. This means close rate can exceed 100% (which is already documented as expected behavior for follow-up sales).

### Files Changed
- `src/hooks/useDashboardMetrics.ts` — expand sales counting to include 2nd-intro-linked runs

