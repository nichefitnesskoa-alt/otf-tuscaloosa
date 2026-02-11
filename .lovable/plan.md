

# VIP Class Pipeline Section

## What This Does

Adds a dedicated "VIP Class" tab to the Client Pipeline that shows all clients whose lead source is "VIP Class" -- regardless of their lifecycle stage. Unlike the other tabs (Upcoming, No-shows, etc.) which filter by status, VIP Class clients will always appear in this tab from booking through purchase, giving your team a single place to track all VIP visitors.

VIP clients will still appear in the regular tabs too (Upcoming, Today, etc.) so they get the same follow-up attention, but the VIP tab gives a consolidated view of just those clients.

## What Your Team Sees

- A new "VIP" tab in the Client Pipeline (both Pipeline page and Admin)
- VIP tab shows a count of all VIP Class clients
- Each client card shows their current status (Active, Purchased, No-show, etc.) so you can see where they are in the journey
- A purple star icon distinguishes the tab visually

---

## Technical Details

### Changes to Both Components

**Files:**
- `src/components/dashboard/ClientJourneyReadOnly.tsx` (Pipeline page)
- `src/components/admin/ClientJourneyPanel.tsx` (Admin page)

In each file:

1. Add `'vip_class'` to the `JourneyTab` type union
2. Add a `vip_class` count to `tabCounts` -- counts ALL journeys (including purchased) where any booking has `lead_source === 'VIP Class'`
3. Add a new `TabsTrigger` for "VIP" with a star icon and count
4. Add filter logic in `filterJourneysByTab`: for `vip_class` tab, return all journeys where any booking's `lead_source` is "VIP Class" (do NOT exclude purchased members -- VIP clients stay visible the entire time)

### Key Difference from Other Tabs

Other tabs exclude purchased members via `hasPurchasedMembership()`. The VIP tab intentionally skips this exclusion so VIP clients remain visible throughout their full lifecycle.

| Action | File | What Changes |
|--------|------|-------------|
| Edit | `src/components/dashboard/ClientJourneyReadOnly.tsx` | Add VIP tab type, count, trigger, and filter logic |
| Edit | `src/components/admin/ClientJourneyPanel.tsx` | Same changes mirrored for Admin view |

