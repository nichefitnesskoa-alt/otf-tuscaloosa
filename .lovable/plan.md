

# Fix: Lead Source Analytics Not Updating After Client Journey Edits

## Problem

When you edit lead sources in the Client Journey panel (Admin), the Lead Source Analytics chart on the Studio/Recaps page doesn't update. This happens because:

1. `ClientJourneyPanel` has its own local data fetching that bypasses the global state
2. When you save an edit, it only refreshes the local panel data
3. The `LeadSourceChart` gets its data from the global DataContext, which is NOT refreshed
4. So the chart shows stale lead source data until you manually refresh the page

## Root Cause

```text
┌──────────────────────────────────────────────────────────────────┐
│                         CURRENT FLOW                              │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ClientJourneyPanel                    Recaps Page                │
│  ┌─────────────────┐                  ┌─────────────────┐        │
│  │ Local fetchData │                  │ LeadSourceChart │        │
│  │ (Supabase)      │                  │                 │        │
│  └────────┬────────┘                  └────────▲────────┘        │
│           │                                    │                  │
│           │ Edit saves                         │ Uses stale data  │
│           │ ↓                                  │                  │
│  ┌────────▼────────┐                  ┌────────┴────────┐        │
│  │ Local state     │    NO SYNC       │ Global Context  │        │
│  │ updates ✓       │ ←─────────────── │ NOT updated ✗   │        │
│  └─────────────────┘                  └─────────────────┘        │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘
```

## Solution

Make `ClientJourneyPanel` call the global `refreshData()` from `useData()` after any booking or run edits. This ensures all components using DataContext see the updated data.

## Technical Changes

### File: `src/components/admin/ClientJourneyPanel.tsx`

**1. Import and use the global DataContext**

Add `useData` import and get `refreshData`:

```typescript
import { useData } from '@/context/DataContext';

// Inside component:
const { refreshData: refreshGlobalData } = useData();
```

**2. Update all save handlers to also refresh global data**

After each successful edit, call `refreshGlobalData()` in addition to the local `fetchData()`:

- `handleSaveBooking` (line 678)
- `handleConfirmPurchase` (line 751)
- `handleMarkNotInterested` (line 778)
- `handleConfirmSetOwner` (line ~825)
- `handleMarkNoShow` (line ~860)
- `handleDeleteBooking` (line ~895)
- `handleRestoreBooking` (line ~930)
- `handleSaveRun` (line ~970)
- `handleLinkRun` (line ~1010)
- `handleAutoFix` (line ~1050)

Example change for `handleSaveBooking`:

```typescript
// Before:
toast.success('Booking updated');
setEditingBooking(null);
await fetchData();

// After:
toast.success('Booking updated');
setEditingBooking(null);
await fetchData();
await refreshGlobalData(); // Refresh global state so charts update
```

## Summary of Changes

| Location | Change |
|----------|--------|
| Line ~71 | Add `import { useData } from '@/context/DataContext'` |
| Line ~183 | Add `const { refreshData: refreshGlobalData } = useData()` |
| Multiple handlers | Add `await refreshGlobalData()` after each save operation |

## After Fix

```text
┌──────────────────────────────────────────────────────────────────┐
│                         FIXED FLOW                                │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ClientJourneyPanel                    Recaps Page                │
│  ┌─────────────────┐                  ┌─────────────────┐        │
│  │ Local fetchData │                  │ LeadSourceChart │        │
│  └────────┬────────┘                  └────────▲────────┘        │
│           │                                    │                  │
│           │ Edit saves                         │ Gets fresh data  │
│           │ ↓                                  │                  │
│  ┌────────▼────────┐    SYNC!         ┌────────┴────────┐        │
│  │ Local state     │ ──────────────→  │ Global Context  │        │
│  │ updates ✓       │  refreshData()   │ UPDATED ✓       │        │
│  └─────────────────┘                  └─────────────────┘        │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘
```

Now when you edit a lead source from "Member Referral" to "Instagram DMs (Friend)", the change will immediately appear in:
- Lead Source Analytics chart
- Pipeline Funnel (if applicable)
- All other components using the global DataContext

