

# App-Wide Card Stability Fix

## Problem

When you edit a coach (or any inline field) on an intro card, the entire card list re-fetches from the database, flashes "Loading...", and re-renders — collapsing the card you were working in. This happens because every inline save triggers a full `refreshAll()` / `refreshData()` call that sets `isLoading = true`, unmounts the card tree, and rebuilds it from scratch.

This affects:
- **MyDay Intros tab** — editing coach, time, source, or any field via IntroCard header or EditBookingDialog
- **Follow-Up tabs** — editing fields on IntroCard in NoShow, DidntBuy, SecondIntro, PlansToReschedule tabs
- **Pipeline Spreadsheet** — inline edits on phone, email, owner, lead source
- **Leads list** — inline phone/email edits
- **TheirStory / SABriefFields** — conversation field saves

## Root Cause Chain

1. Inline edit saves to Supabase
2. Calls `onFieldSaved()` / `onSaved()` / `onRefresh()`
3. Which calls `refreshAll()` → `useUpcomingIntrosData.fetchData()`
4. `fetchData()` sets `isLoading = true` at the top
5. UpcomingIntrosCard renders "Loading..." instead of cards
6. React unmounts all IntroRowCard components → expanded state lost
7. When data returns, cards re-mount collapsed

## Fix Strategy

**Principle: Background refresh, never flash loading, preserve UI state.**

### Change 1 — useUpcomingIntrosData: Silent refresh mode

Add a `silentRefresh` function that fetches data without setting `isLoading = true`. The existing `fetchData` keeps `isLoading` for initial load only. All subsequent refreshes triggered by inline edits use silent mode.

- File: `src/features/myDay/useUpcomingIntrosData.ts`
- Add `isInitialLoad` ref, only set `isLoading(true)` on first fetch
- Export both `refreshAll` (initial) and `silentRefresh` (background)

### Change 2 — UpcomingIntrosCard: Preserve expanded state across refreshes

- File: `src/features/myDay/UpcomingIntrosCard.tsx`
- Pass `silentRefresh` as `onRefresh` to all IntroDayGroup/IntroRowCard children instead of `refreshAll`
- The `expandedBookingId` state already lives here — it won't reset since the component itself doesn't unmount

### Change 3 — IntroCard inline editors: Stop bubbling refresh

- File: `src/components/shared/IntroCard.tsx`
- InlineSelect, InlineText, InlineTimePicker, InlineDatePicker: after saving, do NOT call `onSaved()` (which triggers full refresh). Instead, show the "Saved" checkmark and let the parent decide whether to do a silent background refresh or nothing.
- Add a `silentRefresh` mode where the save just updates local display and optionally triggers a non-loading refetch.

### Change 4 — EditBookingDialog: Don't close card on save

- File: `src/components/myday/EditBookingDialog.tsx`
- `onSaved` callback currently triggers `refreshAll`. Change IntroRowCard to pass `silentRefresh` instead of `onRefresh` to EditBookingDialog.

### Change 5 — useFollowUpData: Silent refresh

- File: `src/features/followUp/useFollowUpData.ts`
- Same pattern: add `silentRefresh` that skips `setIsLoading(true)` on subsequent calls
- Used by FollowUpNeededTab, NoShowTab, SecondIntroTab, PlansToRescheduleTab

### Change 6 — FollowUpList: Background refresh

- File: `src/features/followUp/FollowUpList.tsx`
- Use silent refresh for inline edits (ContactNextEditor, Log as Sent, Dismiss)

### Change 7 — Pipeline: Background refresh for inline edits

- File: `src/features/pipeline/usePipelineData.ts`
- Add silent refresh mode
- File: `src/features/pipeline/components/PipelineSpreadsheet.tsx`
- Inline edits use silent refresh

### Change 8 — Leads list: Background refresh

- File: `src/components/leads/LeadListView.tsx`
- InlineEditField onSave callbacks that call `onRefresh?.()` — ensure the parent refresh doesn't flash loading

### Change 9 — Realtime handler: Silent refresh

- File: `src/features/myDay/MyDayPage.tsx`
- The `useRealtimeMyDay` handler already has a 1500ms debounce but still calls `fetchMetrics()` — ensure it uses silent refresh for the intros data too

### Change 10 — DataContext: Silent refresh option

- File: `src/context/DataContext.tsx`
- Add a `silentRefreshData` that calls `fetchData` without `setIsLoading(true)` — used by components that need fresh global data without UI disruption

## Technical Detail

The key pattern applied everywhere:

```typescript
// Before (causes flash)
const fetchData = useCallback(async () => {
  setIsLoading(true);  // ← This kills the UI
  // ... fetch ...
  setIsLoading(false);
}, []);

// After (preserves UI)
const isFirstLoad = useRef(true);
const fetchData = useCallback(async (silent = false) => {
  if (!silent) setIsLoading(true);
  // ... fetch ...
  setIsLoading(false);
  isFirstLoad.current = false;
}, []);

// Expose both
return { 
  refreshAll: fetchData,           // initial load
  silentRefresh: () => fetchData(true),  // inline edits
};
```

## Files Modified (10 files)

1. `src/features/myDay/useUpcomingIntrosData.ts` — silent refresh
2. `src/features/myDay/UpcomingIntrosCard.tsx` — pass silentRefresh to children
3. `src/features/myDay/IntroRowCard.tsx` — use silentRefresh for edit callbacks
4. `src/features/myDay/MyDayPage.tsx` — realtime uses silent refresh
5. `src/components/shared/IntroCard.tsx` — inline editors don't force full refresh
6. `src/components/myday/EditBookingDialog.tsx` — no behavioral change needed, parent passes silent
7. `src/features/followUp/useFollowUpData.ts` — silent refresh
8. `src/features/followUp/FollowUpList.tsx` — use silent refresh for inline actions
9. `src/features/pipeline/usePipelineData.ts` — silent refresh
10. `src/context/DataContext.tsx` — silentRefreshData export

