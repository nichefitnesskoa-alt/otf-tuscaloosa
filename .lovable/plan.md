

## Problem: Row Expansion Glitch in Virtualized Pipeline Spreadsheet

When you click a row to expand it, the virtualizer "glitches" because it uses `estimateSize` based on `expandedKey`, but `@tanstack/react-virtual` caches size estimates and doesn't automatically recalculate when `expandedKey` changes. This causes the layout to jump — rows overlap or shift incorrectly until the virtualizer catches up.

### Root Cause

The `useVirtualizer` hook caches estimated sizes. When `expandedKey` changes (toggling a row from 40px → 300px), the cached sizes are stale, causing visual glitching as the virtualizer tries to reconcile absolute positioning with wrong height data.

### Fix

1. **In `PipelineSpreadsheet.tsx`** — After `expandedKey` changes, call `virtualizer.measure()` to force the virtualizer to recalculate all row sizes. This is done via a `useEffect` that watches `expandedKey`:

```typescript
useEffect(() => {
  virtualizer.measure();
}, [expandedKey, virtualizer]);
```

2. **Add a stable `getItemKey`** to the virtualizer config so it tracks rows by `memberKey` instead of index — preventing mismatches when rows reorder or the expanded row shifts position:

```typescript
getItemKey: (i) => sorted[i]?.memberKey ?? i,
```

These two changes ensure that when a row is toggled, the virtualizer immediately recalculates the full layout with the correct expanded/collapsed heights, eliminating the visual jump.

