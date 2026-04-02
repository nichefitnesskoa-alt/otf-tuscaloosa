

# Fix Collapsible Intro Cards — Toggle & Labels

## Summary
Two fixes across My Day and Coach View: (1) SA cards can't re-collapse because the expanded state renders IntroCard without a clickable header — add a collapsible header bar above the expanded card. (2) Update collapsed row badges to use full readable labels with shoutout text.

## Root Cause — FIX 1
In `IntroRowCard.tsx`, when `isExpanded` is true (line 341), the component skips the `collapsedRow` button entirely and renders `IntroCard` directly. `IntroCard`'s header div has no `onClick` handler — there's no way to collapse back. The Coach View (`CoachView.tsx` line 396) already works correctly because it always renders the header button above the expanded content.

## File Changes

### 1. `src/features/myDay/IntroRowCard.tsx`

**FIX 1 — Add collapsible header to expanded state:**
- When `isExpanded` is true, render a wrapper that includes the same summary header bar at the top (name, badges, time, coach, chevron) as a clickable button that calls `onExpand?.()` to toggle closed
- The chevron rotates: `ChevronRight` when collapsed, rotated down (via CSS `rotate-90`) when expanded
- Wrap the expanded IntroCard + header in a container div
- Add `e.stopPropagation()` on all child interactive elements inside the header (badges) so they don't interfere

**FIX 2 — Update collapsed row labels:**
- Change `1st`/`2nd` badge text to `1st Intro` / `2nd Intro`
- Change `Q✓`/`Q?`/`Q!` badge text to `Q Complete` / `Q Sent` / `No Q`
- Replace `ShoutoutDot` with dot + text label:
  - `consent === true`: green dot + "Shoutout ✓"
  - `consent === false`: red dot + "Shoutout ✗"
  - `consent === null`: gray dot + "Shoutout?"
- Keep time and coach on the right side

**Auto-expand respect:** The auto-expand `useEffect` in `UpcomingIntrosCard.tsx` already only runs on initial load (items change). The toggle in `handleExpandCard` (line 164) already supports `null` (collapsed). No change needed — manual collapse is already respected since `setExpandedBookingId(null)` persists until the next items array change. Add a ref guard so auto-expand only fires once on mount, not on every items update.

### 2. `src/features/myDay/UpcomingIntrosCard.tsx`

- Add `autoExpandDone` ref, set to `true` after the first auto-expand runs
- Skip auto-expand effect if `autoExpandDone.current` is already true — this prevents re-expanding after manual collapse when realtime updates cause items to refresh

### 3. `src/pages/CoachView.tsx`

**FIX 2 — Update Coach View collapsed row labels to match:**
- Change badge text from abbreviated to full: `1st Intro`/`2nd Intro`, `Q Complete`/`No Q`
- Add shoutout text labels next to dots (same as SA view)
- Coach View already has working toggle (line 381-383) — no FIX 1 needed here

## Technical Details
- The SA card's expanded state will render: `[clickable header bar] + [IntroCard with all content]` — the header bar is the same summary row used in collapsed state, just with the chevron pointing down
- `stopPropagation` on badge/dot children inside the header prevents accidental double-triggers
- The `autoExpandDone` ref ensures that realtime-triggered `items` changes (from `useRealtimeMyDay`) don't re-expand a manually collapsed card

