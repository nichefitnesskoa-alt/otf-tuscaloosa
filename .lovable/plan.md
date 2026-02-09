
# Global Data Refresh Synchronization Plan

## Problem Summary

There are two issues:

1. **Components with local data fetching bypass global state**: Several components in Studio, My Stats, and My Shifts fetch data directly from Supabase instead of using the global DataContext, so they don't update when Admin makes changes.

2. **Lead Source Analytics should be updating but isn't**: The LeadSourceChart uses global state correctly, but there may be a timing or page-navigation issue where the refresh happens on a different page than where you're viewing.

## Root Cause Analysis

```text
CURRENT ARCHITECTURE:

Admin Page                           Other Pages
┌────────────────┐                   ┌────────────────────────┐
│ ClientJourney  │                   │ Recaps (Studio)        │
│ Panel (Admin)  │                   │ ┌──────────────────┐   │
│                │                   │ │ LeadSourceChart  │   │
│ Edit lead      │ refreshGlobalData│ │ uses useData() ✓ │   │
│ source ──────────────────────────► │ └──────────────────┘   │
│                │                   │ ┌──────────────────┐   │
│                │    NOT synced     │ │ ClientJourney    │   │
│                │ ─────────────────X│ │ ReadOnly (local) │   │
│                │                   │ └──────────────────┘   │
└────────────────┘                   │ ┌──────────────────┐   │
                                     │ │ MembersPurchased │   │
                                     │ │ ReadOnly (local) │   │
                                     │ └──────────────────┘   │
                                     └────────────────────────┘

┌────────────────┐                   ┌────────────────────────┐
│ Dashboard      │                   │ MyShifts               │
│ uses useData() │                   │ (local fetchMyRecaps)  │
│ ✓              │                   │ NOT synced with global │
└────────────────┘                   └────────────────────────┘
```

## Solution

### Part 1: Make Local-Fetching Components Listen to Global State

Components with local data fetching need to re-fetch when global data is refreshed. We'll add a `lastUpdated` dependency that triggers re-fetches.

### Part 2: Ensure All Views Respond to Global Refresh

When `refreshGlobalData()` is called from Admin, all pages should see updated data without manual refresh.

---

## Technical Changes

### File 1: `src/components/dashboard/ClientJourneyReadOnly.tsx`

**Add dependency on global lastUpdated to trigger refresh**

```typescript
// Import useData
import { useData } from '@/context/DataContext';

// Inside component:
const { lastUpdated: globalLastUpdated } = useData();

// Add effect to refetch when global data changes
useEffect(() => {
  if (globalLastUpdated) {
    fetchData();
  }
}, [globalLastUpdated]);
```

### File 2: `src/components/dashboard/MembershipPurchasesReadOnly.tsx`

**Add dependency on global lastUpdated**

```typescript
// Import useData
import { useData } from '@/context/DataContext';

// Inside component:
const { lastUpdated: globalLastUpdated } = useData();

// Add effect to refetch when global data changes
useEffect(() => {
  if (globalLastUpdated && dateRange) {
    fetchPurchases();
  }
}, [globalLastUpdated, dateRange]);
```

### File 3: `src/pages/MyShifts.tsx`

**Add dependency on global lastUpdated**

```typescript
// Import useData
import { useData } from '@/context/DataContext';

// Inside component:
const { lastUpdated: globalLastUpdated } = useData();

// Add effect to refetch when global data changes
useEffect(() => {
  if (globalLastUpdated) {
    fetchMyRecaps();
  }
}, [globalLastUpdated, user?.name]);
```

### File 4: `src/pages/Dashboard.tsx` (My Stats)

**Already uses useData() correctly** - no changes needed. The `useDashboardMetrics` hook recomputes when global data changes.

### File 5: `src/pages/Recaps.tsx` (Studio)

**Already uses useData() correctly** - LeadSourceChart should update. However, let's verify by adding a console log temporarily or ensuring the refresh triggers correctly.

---

## Summary Table

| Component | Current State | Change |
|-----------|--------------|--------|
| `ClientJourneyReadOnly.tsx` | Local fetch bypasses global | Add `lastUpdated` listener |
| `MembershipPurchasesReadOnly.tsx` | Local fetch bypasses global | Add `lastUpdated` listener |
| `MyShifts.tsx` | Local fetch bypasses global | Add `lastUpdated` listener |
| `Dashboard.tsx` (My Stats) | Uses global context | No changes |
| `Recaps.tsx` (Studio) | Uses global context | No changes |
| `LeadSourceChart.tsx` | Pure component, uses props | No changes |

---

## Why Lead Source Analytics Should Already Work

The `LeadSourceChart` on the Recaps page:
1. Gets `data={metrics.leadSourceMetrics}` from `useDashboardMetrics`
2. `useDashboardMetrics` uses `introsBooked` from `useData()`
3. When `refreshGlobalData()` is called, `introsBooked` updates
4. The `useMemo` in `useDashboardMetrics` recalculates `leadSourceMetrics`
5. `LeadSourceChart` re-renders with new data

If it's not updating, the issue may be:
- You're editing in Admin, but haven't navigated back to Studio/Recaps
- The page needs to be in view when the refresh happens
- Or there may be a caching issue in the browser

**Recommended test**: After making changes in Admin, click the refresh button (↻) on the Recaps page manually to verify the data is correct in the database.

---

## After This Fix

```text
FIXED ARCHITECTURE:

Admin Page                           Other Pages
┌────────────────┐                   ┌────────────────────────┐
│ ClientJourney  │                   │ Recaps (Studio)        │
│ Panel (Admin)  │                   │ ┌──────────────────┐   │
│                │                   │ │ LeadSourceChart  │ ✓ │
│ Edit lead      │ refreshGlobalData│ └──────────────────┘   │
│ source ──────────────────────────► │ ┌──────────────────┐   │
│                │                   │ │ ClientJourney    │   │
│                │ lastUpdated ─────►│ │ ReadOnly ✓       │   │
│                │ triggers refetch  │ └──────────────────┘   │
│                │                   │ ┌──────────────────┐   │
│                │                   │ │ MembersPurchased │   │
│                │                   │ │ ReadOnly ✓       │   │
└────────────────┘                   └──────────────────────────┘

                                     ┌────────────────────────┐
                                     │ MyShifts ✓             │
                                     │ Now syncs with global  │
                                     └────────────────────────┘
```

All components will now respond to global data changes without requiring a manual page refresh.
