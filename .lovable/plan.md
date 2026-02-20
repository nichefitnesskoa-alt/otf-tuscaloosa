
# Fix: React Error #300 in PipelineTable

## Root Cause Identified

In `src/features/pipeline/components/PipelineTable.tsx`, the `useVirtualizer` hook (line 122) is called **after** a conditional early `return` statement (lines 69-119). When `activeTab === 'vip_class'`, the component returns early and `useVirtualizer` is never called. When the tab changes back to a non-VIP tab, `useVirtualizer` is called again — this changes the hook call count between renders and triggers React error #300.

```typescript
// ❌ CURRENT — BROKEN
if (activeTab === 'vip_class' && vipGroups) {
  return ( ... ); // Early return on line 69
}

// useVirtualizer is called AFTER the early return — React error #300
const virtualizer = useVirtualizer({ ... }); // line 122
```

This is precisely the pattern described in the React docs for invariant #300: hooks must be called in the same order on every render, unconditionally.

## Fix

Move `useVirtualizer` to the **top of the component**, before any conditional returns. The virtualizer will be initialized on every render regardless of which tab is active, which satisfies React's rules of hooks.

```typescript
// ✅ FIXED — hook called unconditionally at top
const virtualizer = useVirtualizer({
  count: journeys.length,  // will be 0 when VIP tab active, harmless
  getScrollElement: () => parentRef.current,
  estimateSize: () => ESTIMATED_ROW_HEIGHT,
  overscan: 10,
});

// Now the conditional return is safe — hook already called above
if (activeTab === 'vip_class' && vipGroups) {
  return ( ... );
}
```

When `activeTab === 'vip_class'`, the virtualizer will initialize with `count: journeys.length` (which may be 0 or whatever filtered journeys exist), but it will never be rendered since the early return shows the VIP grouped view instead. This is completely harmless — the hook is always called, the order never changes.

## File Changed

**`src/features/pipeline/components/PipelineTable.tsx`** — Move `useVirtualizer` call from line 122 to above the `if (activeTab === 'vip_class')` guard on line 69. No other changes needed.

## Why No Other Files Need Changes

- `PipelineNewLeadsTab.tsx` and `MyDayNewLeadsTab.tsx` — all hooks are at the top level of each component, no conditional hooks present. The `LeadCard` subcomponent is a proper React component with hooks at its top level.
- `PipelinePage.tsx` — no conditional hooks.
- `MyDayPage.tsx` — no conditional hooks.

This is a single-line relocation fix that will completely eliminate the React error #300 crash on the Pipeline page.
