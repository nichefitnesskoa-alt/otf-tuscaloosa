

## Root Cause

The database confirms all 3 bookings by Koa exist and are correctly configured — no exclusions, no `originating_booking_id`, proper statuses. The filtering logic in `useDashboardMetrics` would count all 3.

The real problem is **stale data in DataContext**. When you book intros (via BookIntroSheet, WalkInIntroSheet, or FriendReferralDialog), those components dispatch a `myday:walk-in-added` event, but **DataContext never listens for it**. Only the MyDay page's `UpcomingIntrosCard` refreshes on that event. So when you navigate to Recaps, the Booker Stats shows whatever DataContext loaded when the app first started — before your newest bookings existed.

The previous friend-booking fix (removing `originating_booking_id`) was correct and is working — all 3 DB records look clean. This is purely a data freshness issue.

## Fix

### 1. DataContext: auto-refresh on booking events

Add a listener for `myday:walk-in-added` in `DataContext.tsx` so that ANY new booking automatically refreshes all data app-wide. This means Recaps, Pipeline, Shift Recap, and every other DataContext consumer immediately reflects new bookings.

### 2. Also add `referred_by_member_name` to `useLeadMeasures` select

The `useLeadMeasures` hook queries `intros_booked` directly (not via DataContext) but its `select()` does NOT include `referred_by_member_name`. The filter on line 65 checks `b.referred_by_member_name` — which will always be `undefined` since the column isn't fetched. This doesn't cause the current bug (since all 3 bookings have `originating_booking_id = NULL`), but it will break for any future friend booking that somehow gets an `originating_booking_id`. Add it to the select to be safe.

### 3. Add `referred_by_member_name` to the IntroBooked interface

The `IntroBooked` interface in DataContext doesn't declare `referred_by_member_name`, forcing all consumers to use `(b as any)` casts. Adding it makes the code type-safe and prevents future bugs.

