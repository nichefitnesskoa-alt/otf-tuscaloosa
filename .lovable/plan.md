
# Fix Mobile Layout Overflow

## Problem
Several elements cause horizontal overflow and poor fit on mobile screens:

1. **`App.css` root padding**: The `#root` selector applies `padding: 2rem` (32px per side), stealing 64px of horizontal space on every page.
2. **Header overflow**: The header row contains logo, user name, role badge, alert bell, and logout button all in one line with no wrapping or truncation. On narrow screens (390px), this overflows.
3. **BottomNav crowding**: Admin users see 9 nav items in a single row (`flex justify-around`), causing tiny tap targets and potential overflow.
4. **No global overflow prevention**: Nothing prevents the body/root from scrolling horizontally when child content pushes wider than the viewport.

## Plan

### 1. Fix App.css root styles
Remove the `padding: 2rem` and `max-width: 1280px` from `#root` since they conflict with the full-width mobile layout. The `AppLayout` and individual pages already handle their own padding.

### 2. Add global overflow-x prevention
In `index.css`, add `overflow-x: hidden` to the `html` and `body` elements to prevent horizontal scroll.

### 3. Make Header mobile-responsive
- Hide the user's name text on small screens (show only on `sm:` breakpoint and above)
- Keep the OTF logo, alert bell, role badge, and logout button visible
- Add `overflow-hidden` and `min-w-0` to prevent the header from forcing horizontal scroll

### 4. Make BottomNav scrollable on mobile
- For Admin users with 9 items, add `overflow-x-auto` and `scrollbar-hide` so the nav items can scroll horizontally without overflowing the viewport
- Slightly reduce icon/text sizing for better fit

### 5. Ensure card content doesn't overflow
- Add `overflow-hidden` to the main content wrapper in `AppLayout`
- Ensure intro cards and lead cards use `min-w-0` on flex children to allow text truncation

## Files to modify
- `src/App.css` -- remove conflicting root styles
- `src/index.css` -- add overflow-x prevention
- `src/components/Header.tsx` -- responsive header layout
- `src/components/BottomNav.tsx` -- handle many nav items gracefully
- `src/components/AppLayout.tsx` -- add overflow protection
