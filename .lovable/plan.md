## Anna Pauley → Jayna fix

**Root cause.** There are two `leads` rows for Anna Pauley (614-633-6157 / [amgirl423@gmail.com](mailto:amgirl423@gmail.com)):

1. `7a5f57…` — created 6/14, source `Instagram DMs`, `sourced_by_sa = NULL`, not linked to a booking.
2. `c2f2a5…` — created 6/22, source `Event`, `**sourced_by_sa = 'Ellie'**`, linked to booking `4a0621…`.

The booking itself (`4a0621…`, member `Anna Pauley`, source `Event`) has `booked_by = 'Jayna'`.

In `useSaLeads` the credit flow is: leads-row credit wins, and any booking already linked from a leads row is skipped in the bookings pass. So Anna is being credited to **Ellie** (from the wrong leads row) instead of **Jayna** (the booked_by on the actual Turbo Coffee booking). The leads-row SA was entered incorrectly — Jayna was the one working the Turbo Coffee event and made the booking.

No code logic is wrong here — the credit-routing rules are correct; the leads row is just attributed to the wrong SA. The fix is a one-row data correction.

## Change

Update `leads.sourced_by_sa` from `'Ellie'` to `'Jayna'` on row `c2f2a5c2-9543-4cbf-8935-fbecde768409`. Source stays `Event`. Booking link stays.

The duplicate IG-DMs lead (`7a5f57…`) is left alone — it's unattributed and not double-counted.

## Verify (coherence proof)

After the update:

- `SELECT sourced_by_sa FROM leads WHERE id = 'c2f2a5…'` → `Jayna`
- WIG → SA Leaderboard → Jayna's "Sourced leads" drilldown should list **Anna Pauley** (source `Event`, booked = true, linked to booking `4a0621…`).
- Ellie's drilldown should no longer list Anna Pauley.
- `useSaLeadsBooked` for Jayna already includes Anna via `booked_by = 'Jayna'` (unchanged) — totals stay consistent.

## Going forward

If Koa wants to prevent this class of mistake (a manually entered leads row with the wrong SA overriding the booking's real `booked_by`), that's a separate audit/UI guard — happy to follow up with a plan for that if you want it. For now this just fixes Anna.  
  
Manually entered leads trump the SA booking them as far as where as the lead came from. The other person who actually books the class won't get credit for the lead, but will get credit for the actual booking itself