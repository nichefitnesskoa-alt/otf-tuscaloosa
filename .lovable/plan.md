

## Root Cause: Timezone Mismatch in Shift Recap Queries

The shift recap "Booked: 0" issue is caused by a **timezone bug** in `CloseOutShift.tsx`. Here's what's happening:

1. **Your local time is CST (UTC-6)**. When you book intros at, say, 9 PM CST on March 2, the database stores `created_at` as `2026-03-03 03:08 UTC` (next day in UTC).

2. The shift recap builds date filters using naive timestamps like `'2026-03-02T00:00:00'` and `'2026-03-03T00:00:00'`. PostgREST interprets these as **UTC midnight**, not your local midnight.

3. So any booking you create **after 6 PM CST** (midnight UTC) gets a `created_at` that falls *after* the UTC cutoff — it's excluded from "today's" recap entirely.

**Your bookings are in the database** — they're just being filtered out by the timezone-naive query.

The same issue likely affects the `ShiftRecapAutoBuild` component and any other component using `getLocalDateString() + 'T00:00:00'` to filter `created_at` timestamps.

## Fix Plan

### 1. Fix timezone-aware date boundaries (CloseOutShift.tsx)

Replace the naive timestamp construction:
```
// BEFORE (broken):
const todayStart = today + 'T00:00:00';
const tomorrowStart = format(tomorrow, 'yyyy-MM-dd') + 'T00:00:00';

// AFTER (correct):
// Build proper local midnight in ISO with timezone offset
const todayDate = new Date();
todayDate.setHours(0, 0, 0, 0); // local midnight
const todayStart = todayDate.toISOString();
const tomorrowDate = new Date(todayDate);
tomorrowDate.setDate(tomorrowDate.getDate() + 1);
const tomorrowStart = tomorrowDate.toISOString();
```

This ensures the filter boundaries align with the user's local day, not UTC midnight.

### 2. Apply same fix to ShiftRecapAutoBuild.tsx

Same pattern — uses `today + 'T00:00:00'` for the `todayStart` filter on `script_actions`, `follow_up_queue`, and `intros_run`. Apply the same local-midnight-to-ISO fix.

### 3. Audit other components using this pattern

Search for all instances of `+ 'T00:00:00'` date boundary construction and fix them consistently. Key files likely affected:
- `MyDayShiftSummary.tsx` (shift activity autosave query)
- `useLeadMeasures.ts`
- `MyDayTopPanel` or any component querying by `created_at` with naive dates

### Technical Detail

The fix converts local midnight to a proper ISO string with UTC offset (e.g., `2026-03-03T06:00:00.000Z` for CST midnight), so PostgREST compares apples to apples against the `timestamp with time zone` columns.

