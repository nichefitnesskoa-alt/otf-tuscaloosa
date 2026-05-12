## Own It — Week navigator + auto-complete

### Problem
- Past meetings only show in history if they were manually marked `complete`. Last week's meeting never got marked, so it disappeared from view.
- The Upcoming / Live / Complete dropdown is friction. Status should be inferred from the date, not chosen.
- There's no way to walk forward/back through weeks. Everyone needs to see prior results and plan ahead.

### Changes

**1. Auto-complete past meetings (`src/hooks/useTheTable.ts` — `useCurrentMeeting`)**
On every load of a meeting, after fetching, compare `meeting_date` to today's Monday in America/Chicago:
- If `meeting_date < currentMondayCT` AND `status !== 'complete'` → write `status = 'complete'` and refetch.
- This recovers Kaiya's prior week silently the first time anyone opens the page.

**2. Week navigator on `src/pages/TheTable.tsx`**
Replace the status `<Select>` in the header with a week stepper, modeled on Upcoming Intros:

```text
[‹ Prev week]   Week of Mon, May 11   [Today]   [Next week ›]
```

- State: `weekDate: string` (YYYY-MM-DD, always a Monday in CT). Default = `nextMondayCT()`.
- `‹` / `›` buttons shift `weekDate` by ±7 days.
- `Today` button resets to `nextMondayCT()`.
- All staff see the controls (not just admin) — the user said "everyone should be able to move weeks".

**3. `useCurrentMeeting` accepts a target date**
Change signature to `useCurrentMeeting({ meetingId?, weekDate? })`:
- If `meetingId` → load that row by id (deep-link path stays intact).
- Else → load by `meeting_date = weekDate`. If no row exists:
  - For the **current** week → auto-create as today (existing behavior, status `upcoming`).
  - For **past** weeks → return `null` and show an empty-state card ("No Own It record for week of …"). Don't auto-create historical rows.
  - For **future** weeks → auto-create with status `upcoming` so users can plan ahead. (CONFIRM THIS VALUE — auto-create future weeks vs. require admin to seed them. Default plan: auto-create.)

**4. Drop the status selector + status badge from the header**
- Remove the `Upcoming / Live / Complete` `<Select>` entirely.
- Replace the status `<Badge>` next to the meeting date with a derived label:
  - `weekDate < currentMonday` → "Past"
  - `weekDate === currentMonday` → "This week"
  - `weekDate > currentMonday` → "Upcoming"

**5. Phase = derived, not stored**
The page currently branches on `meeting.status` to show preMeetingView / liveView / completeView. Replace with:
- `weekDate < currentMonday` → render `completeView` (read-only-friendly summary + action items + Koa close).
- `weekDate === currentMonday` → render the existing pre-meeting view (lanes, owner cards, peer entries) AND show the live carousel inline below it, so the meeting flows naturally without a status flip. (CONFIRM THIS VALUE — combine into one view vs. keep separate live phase.)
- `weekDate > currentMonday` → render `preMeetingView` only (planning ahead, owners draft entries early).

This eliminates the need to ever click "Live" or "Complete".

**6. Keep `/the-table/history`**
History page stays for the searchable archive view. Update its filter from `status = 'complete'` to `meeting_date < currentMonday` so it surfaces every prior week, including ones that were never manually closed.

### Files touched
- `src/hooks/useTheTable.ts` — `useCurrentMeeting` (date-aware, auto-complete past)
- `src/pages/TheTable.tsx` — week stepper header, derived phase, drop status select
- `src/pages/TheTableHistory.tsx` — broaden the history query

### Coherence verification
- Open Own It on a Monday morning → sees current week, status badge "This week", lanes editable.
- Click `‹` once → loads last week, action items + wins visible read-only, history reachable.
- Click `›` past today → empty future week, can pre-write lane entries.
- Past unclosed meeting auto-flips to `complete` once anyone navigates to it; appears in `/the-table/history` afterward.
- Deep-link `/the-table/:meetingId` still works (uses meetingId branch).
- Carry-forward block still loads (it's keyed by `meeting?.id`, not status).

### Open questions
- Auto-create future weekly rows on navigate? (Default: yes, status `upcoming`.)
- Combine pre-meeting + live into one screen for the current week? (Default: yes, removes the "Live" toggle entirely.)
