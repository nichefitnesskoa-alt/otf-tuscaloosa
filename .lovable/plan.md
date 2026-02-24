

# Make Outcome Badge Tappable to Open Outcome Drawer

## Problem
The outcome result badge in Row 2 (line 259-274) and the bottom status banner (lines 375-400) are not interactive. To edit an outcome, the SA must scroll down to find and tap the "Outcome" button. The user wants to tap directly on the visible outcome badge to open the outcome editor.

## Changes — `src/features/myDay/IntroRowCard.tsx`

### 1. Make the outcome result badge in Row 2 tappable
Wrap the existing `Badge` at lines 259-274 in a `button` element that calls `setOutcomeOpen(true)` on click. Add `cursor-pointer` styling so it's obvious it's tappable.

### 2. Make the bottom outcome status banner tappable
Wrap the `StatusBanner` at lines 375-400 in a `button` element that also calls `setOutcomeOpen(true)`. Add `cursor-pointer` and a subtle hover effect.

Both tap targets open the same `OutcomeDrawer` that the "Outcome" button already uses — no new components or data flows needed.

## File Changed

| File | Change |
|------|--------|
| `src/features/myDay/IntroRowCard.tsx` | Wrap outcome badge (Row 2) and outcome bottom banner in tappable elements that toggle `setOutcomeOpen(true)` |

