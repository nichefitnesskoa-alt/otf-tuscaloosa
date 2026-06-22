## What's happening — root cause of the duplicate

Perla Arce shows twice in Zoe's self-sourced drill-down. The DB confirms it:

```
intros_booked:
  7ac22cc2…  Perla Arce  Member Referral  Zoe  Jun 20  origin = NULL
  5bfca1e6…  Perla Arce  Member Referral  Zoe  Jun 22  origin = 7ac22cc2… ← child of the Jun 20 booking
```

The Jun 22 row is a **child booking** (originating_booking_id points back to Jun 20) — i.e. a rebook / 2nd attempt for the same person.

`src/hooks/useSaLeads.ts` aggregates self-sourced leads from two paths:
1. `leads` rows tagged with `sourced_by_sa` (deduped by `booked_intro_id`).
2. `intros_booked` rows whose source qualifies AND aren't linked from a leads row.

Path 2 has no concept of "same person, multiple bookings." Every booking row is counted as a separate self-sourced lead. So any rebook, reschedule, or 2nd-intro booking for a Member Referral / Friend / etc. inflates the SA's lead count by 1 per child booking.

This violates the rule: a self-sourced "lead" is a **person**, not a booking row.

## Plan

### 1. Fix the root cause (deduplicate by person)
In `src/hooks/useSaLeads.ts`, path 2:
- Add `originating_booking_id` to the select.
- Drop any booking where `originating_booking_id IS NOT NULL` — the originating row already represents that person. Child bookings (rebooks, 2nd intros) never add a new self-sourced lead.

This alone makes Zoe's count drop from 11 → 10 and removes the duplicate Perla Arce (Jun 22) row.

### 2. Give Koa a way to delete a bogus lead from the drilldown
For the rare case where a true duplicate slips through (e.g. same person entered as two separate `leads` rows with different spellings, or two unlinked bookings with no parent/child relationship), add an admin-only delete control inside the `PersonListDrillDown` self-sourced view:

- Small trash icon on the right of each row, **Admin only** (`isAdmin` check, Koa identity).
- Click → confirm dialog: "Remove {name} from {SA}'s self-sourced count? This won't delete the booking or the lead, just exclude it from this metric."
- Behaviour by row source:
  - `lead-{id}` row → set `leads.sourced_by_sa = NULL` (preserves the lead, just unattributes it from the SA's self-sourced count — matches the existing predicate that requires `sourced_by_sa IS NOT NULL`).
  - `bk-{id}` row → set `intros_booked.ignore_from_metrics = true` (canonical "hide from metrics" flag already used elsewhere).
- After mutation: emit `DATA_CHANGED_EVENT` with scopes `['leads','intros_booked','sa-leads']` so every consumer (WIG hero, leaderboard, drilldown, per-SA page) refetches.

### 3. Verify coherence
- DB query: confirm Perla Arce Jun 22 row no longer appears in path 2 result; counts decrement by 1.
- Cross-page: Zoe's tile on hero (43 of 66), leaderboard cell, and drilldown all show the same new number.
- Per-SA page (`/sas/Zoe`) uses the same hook → also updates.
- Admin delete: select one bogus row, confirm count decrements on all three surfaces, confirm the underlying booking/lead row is preserved (only the metric flag changed).

### Files touched
- `src/hooks/useSaLeads.ts` — add `originating_booking_id` filter; export delete helpers `unattributeLead(leadId)` and `excludeBookingFromMetrics(bookingId)`.
- `src/components/wig/WigSaLeaderboard.tsx` — pass `isAdmin` and a remove handler into the drilldown rows.
- `src/components/wig/PersonListDrillDown.tsx` (or wherever rows render) — render trash button + confirm dialog when row has an `onRemove` callback.

### Out of scope
- No changes to leads ingestion dedup (Phone/Email rules already cover that path; the bug is purely metric aggregation).
- No hard delete of `leads` or `intros_booked` rows.
- No change to booked/sales drilldowns — they already key off the right entity.

### Coherence proof I'll produce on completion
DB rows verified: Perla Arce 5bfca1e6… excluded from path 2 result. Cross-page numbers: WIG hero "Team self-generated leads", SA Leaderboard Zoe cell, drilldown count badge, `/sas/Zoe` self-sourced count — all agree.
