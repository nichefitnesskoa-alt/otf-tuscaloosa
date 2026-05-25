## Two small VIP scheduler fixes

### 1. Group contact — option to add them to the class as an attendee

**Problem:** Group contact (e.g. Nicole Welch on Bama Dining) attended the class but never filled out the member form, so she's not counted in Registered / Intros / exports.

**Change in `src/features/pipeline/components/VipSchedulerTab.tsx`:**

- On the Group Contact card inside the Registrations dialog, add a small checkbox / toggle: **"Also attending the class"**.
- Bound to the existing `is_group_contact` row's behavior — we keep `is_group_contact = true` but add a sibling boolean `attending_class` on `vip_registrations` (new column, default false). When toggled on, that contact is counted exactly like a member everywhere we currently do `registrations.filter(r => !r.is_group_contact)`.
- Update all member-count selectors in this file (the four `!r.is_group_contact` filters around lines 256, 863, 872, 959, 965, 1030, 1049) to use a shared helper `isCountedAsMember(r) = !r.is_group_contact || r.attending_class === true`.
- Same helper drives the `regCounts` map (line 251–256) so the "X registered" badge on each session card increments when the group contact is marked attending.
- Inline "+ Add Person" form already exists for adding more people — no change needed there; user already has that.
- Group contact still renders in its branded card (not duplicated in the members table) — just counted.

**DB migration:** `ALTER TABLE vip_registrations ADD COLUMN attending_class boolean NOT NULL DEFAULT false;`

### 2. View Past Dates — only show booked sessions

**Problem:** Toggling "View Past Dates" floods the list with empty open/cancelled slots that were never reserved. Useless space.

**Change in `src/features/pipeline/components/VipSchedulerTab.tsx` (filter around line 561–565):**

When `showPast` is true AND the session is in the past, only include it if it's a real booking — i.e. `status === 'reserved'` OR `status === 'completed'` OR `reserved_by_group` is non-null. Upcoming sessions (today + future) keep showing everything (open + reserved + cancelled) as today.

If `pastJumpDate` is set, same rule applies to anything before today; from today forward show all.

Update the helper-text line (553–555) to say "Showing booked past + all upcoming".

### Coherence checks before done
- Bama Dining May 22 with Nicole toggled on → Registered = 7, member list still shows 6, CSV export still 6 (group contact stays in her branded card, not duplicated in the table).
- Toggle off → Registered = 6 again. Realtime/refresh consistent.
- "View Past Dates" → only reserved/completed past sessions appear; empty Open past slots hidden.
- VIP Pipeline tab + Performance dashboard counts unaffected (they use the same registrations table — verify the shared helper is exported and reused if those surfaces also filter on `is_group_contact`).

### Files touched
- `src/features/pipeline/components/VipSchedulerTab.tsx`
- New Supabase migration adding `attending_class` boolean to `vip_registrations`
- Audit `VipPipelineTable.tsx` and `VipPerformanceDashboard.tsx` for any `is_group_contact` filters and update to the shared helper if present.
