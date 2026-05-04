# Fix: Coaching script viewer cut off by bottom nav

## Problem
On `/coach-view`, opening a coaching script (e.g. "2G — May 4, 2026") renders the doc viewer as a full-screen `fixed inset-0` overlay. The global `BottomNav` is also `fixed bottom-0` at the same `z-50`, so it sits on top of the viewer and clips the last ~64px (plus safe-area) of the script content. You can't scroll past the nav to see the final rows.

## Fix
Constrain the script viewer overlay so its bottom ends above the bottom nav instead of running underneath it.

In `src/components/coach/CoachingScripts.tsx`, the `ScriptViewer` component's root:

- Change `fixed inset-0 z-50` → `fixed inset-x-0 top-0 bottom-16 z-40 pb-[env(safe-area-inset-bottom)]`
  - `bottom-16` reserves the 64px bottom-nav height.
  - `pb-[env(safe-area-inset-bottom)]` keeps it clean on iOS notched devices.
  - `z-40` keeps the viewer below the nav (z-50) so the nav is never visually overlapped either.

The inner flex layout (`flex flex-col` with `flex-1 overflow-auto` content area) already handles internal scrolling, so the doc/PDF content will now scroll fully within the visible area and the last rows of the workout become reachable.

No behavior changes to upload, list, delete, or PDF/DOCX rendering — purely a layout adjustment to one wrapper div.

## Files touched
- `src/components/coach/CoachingScripts.tsx` (one className change on the `ScriptViewer` root div, ~line 90)
