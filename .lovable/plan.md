

# Add WIG Tab to Coach Navigation

## Problem
Coaches only see a single "Coach View" button in the bottom nav. They need access to the WIG tab as well.

## Change

**File: `src/components/BottomNav.tsx`**

Update the coach bottom nav section (lines 34-58) to show two buttons instead of one:
1. **Coach View** (Eye icon) — links to `/coach-view`
2. **WIG** (Trophy icon) — links to `/wig`

Both buttons get the same active-state styling based on current path. The `/wig` route already allows coach access (no `blockCoach` flag), so no routing changes needed.

## What does NOT change
- WIG page content or logic
- Routes in App.tsx
- Admin or SA navigation
- AppLayout (coaches already get a minimal layout without Header)

