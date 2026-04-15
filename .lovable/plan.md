

## Plan: Public VIP Registration Roster Page + Link in QR Dialog

### Overview
Create a new public page at `/vip/:slug/roster` that shows the group organizer a live list of who has registered for their session. Add a "Copy Roster Link" button alongside the existing QR code and registration link in the VIP Scheduler.

### Changes

**1. New page: `src/pages/VipRoster.tsx`**

Public page (no auth). Resolves the session via `shareable_slug` from `vip_sessions`, then queries `vip_registrations` where `vip_session_id` matches.

Display:
- OTF logo header, group name, session date/time
- Registration count ("12 registered so far")
- List of registrants showing: first name, last name initial (privacy — e.g. "Sarah M."), and registration timestamp
- No email, phone, birthday, or weight shown (privacy)
- Auto-refreshes every 30 seconds via polling (simple, no auth needed for realtime)
- Empty state: "No registrations yet. Share the registration link to get started!"
- OTF Orange accent, white background (public page styling matching VipMemberRegister)

**2. Route: `src/App.tsx`**

Add `<Route path="/vip/:slug/roster" element={<VipRoster />} />` next to the existing `/vip/:slug/register` route.

**3. VIP Scheduler links: `src/features/pipeline/components/VipSchedulerTab.tsx`**

Two additions:
- On reserved session cards: add a "Copy Roster Link" button (same row as "Copy Member Link" and "Download QR") that copies `https://otf-tuscaloosa.lovable.app/vip/{slug}/roster`
- In the QR download dialog: add the roster link below the QR code as a second copyable link with label "Roster link (share with organizer)"

### No database changes
The roster page reads from existing `vip_sessions` and `vip_registrations` tables using the existing public RLS policies.

### Files changed
1. `src/pages/VipRoster.tsx` — new public roster page
2. `src/App.tsx` — add route
3. `src/features/pipeline/components/VipSchedulerTab.tsx` — add copy/share buttons

