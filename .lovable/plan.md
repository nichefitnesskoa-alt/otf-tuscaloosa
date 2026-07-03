## Goal
Everyone (SAs, Coaches, Admin) can see the upcoming churn list from the Net Gain scoreboard, and the scoreboard shows the next churn date + how many people churn on that day at a glance.

## Changes (single file: `src/components/shared/NetGainScoreboard.tsx`)

### 1. At-a-glance "next churn" chip on the scoreboard
Compute from the already-loaded `pendingChurns` (sorted asc by `churn_date`):
- `nextChurnDate` = `pendingChurns[0].churn_date`
- `nextChurnCount` = number of pending churns whose `churn_date === nextChurnDate`

Add a new line to the existing bottom strip (above/next to the "X scheduled terminations left" text):

> **Next churn: Nov 12 — 3 members** → [View all]

- Date formatted as `MMM d` via `parseLocalDate` + `format` (Central-safe).
- The whole line is a button that opens the new upcoming-churns dialog.
- Show the strip whenever `pendingChurns.length > 0` (currently strip already renders in that case).

### 2. New read-only "Upcoming Churns" dialog (all roles)
New component `UpcomingChurnsDialog` — visible to everyone. Rendered alongside `HistoryDialog`.
- Header: "Upcoming churns — {N} through {end-of-month label}"
- List grouped by `churn_date`, each group showing:
  - Date header (`EEE, MMM d`) with a count pill (`3 members`)
  - Rows: member name + optional notes
- Empty state: "No scheduled churns. 🎉"
- Pure read — no edit/delete controls here (admins still have the pencil/list icons for management).

### 3. Access button for non-admins
Replace the current non-admin "History" button with two small buttons:
- **Upcoming** (opens `UpcomingChurnsDialog`) — shows a count badge when `pendingChurns.length > 0`
- **History** (unchanged)

For admins, add an "Upcoming" icon button (Calendar icon) into the existing admin control row so they can open the same read-only view without going through the admin Manage dialog.

## Out of scope
- No DB/schema changes — `net_gain_churns` already has everything needed and is already fetched.
- No changes to churn-date parsing logic, upload flow, or admin management dialog.
- No changes to how the Net Gain number is computed.

## Coherence check (before done)
- Verify with `read_query` on `net_gain_churns` (applied_at IS NULL, churn_date ≤ EOM) that the earliest `churn_date` matches what the scoreboard shows and that the group count for that date matches the "N members" chip.
- Confirm the dialog opens for a non-admin identity (Coach + SA) and an admin identity, and shows the same rows in both.
- Confirm existing "scheduled terminations left" number still equals `pendingChurns.length` and equals the total row count in the new dialog.
