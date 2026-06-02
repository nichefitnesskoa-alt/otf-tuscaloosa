# Intro Owner Change Doesn't Propagate to Runs

## Root cause

When the journey card edits intro owner, `syncIntroOwnerToBooking` (in `src/features/pipeline/pipelineActions.ts`) only updates `intros_booked.intro_owner`. It does NOT update `intros_run.intro_owner` on the linked run rows.

Per-SA Performance in `src/hooks/useDashboardMetrics.ts` (lines 226-228, 264-274) builds the SA list and aggregates **from `intros_run.intro_owner`**. So after the edit:

- Koa is still in the table because his run still says `intro_owner = 'Koa'`.
- Danielle Mars is still in the table for the same reason, but her drilldown reads `intros_booked.intro_owner` → 0 bookings → "No intros found".
- Grace F doesn't appear because no run row says `intro_owner = 'Grace F'`.

Same drift hits any other consumer that reads `intros_run.intro_owner` directly (`useLeadMeasures`, etc.).

## Reach map

- Writes: `syncIntroOwnerToBooking` (one place) — currently writes booking only.
- Reads of `intros_run.intro_owner`: `useDashboardMetrics` (Per-SA, scoreboard tallies at 528 / 556-560), `useLeadMeasures`.
- Reads of `intros_booked.intro_owner`: PersonJourneyCard, PerSATable drill, useSaSales, salesBooked, Pipeline, ManageOwners, EditSale, MyDay/Coach surfaces.
- React Query keys touched: anything keyed on `intros_run` / `intros_booked` / `dashboard-metrics` / `sa-leads-booked` / `sa-sales`.

The booking is the source of truth (it's what every owner-editor writes to). Runs carry a denormalized copy. The fix is to keep the run copy in lockstep with the booking on every owner edit, plus invalidate every cache key that reads either table.

## Changes

1. **`src/features/pipeline/pipelineActions.ts` → `syncIntroOwnerToBooking`**
   - After the booking UPDATE succeeds, UPDATE `intros_run` SET `intro_owner = <new>` WHERE `linked_intro_booked_id = bookingId`.
   - Also walk the chain: find any booking whose `originating_booking_id = bookingId` (2nd intros that originated from this one) and update their runs too. This keeps total-journey sales attributed to the right SA.
   - Add a second `outcome_events` row for the run sync (best-effort, non-blocking).
   - Return false if either booking or run update errors; surface error to the caller.

2. **`src/components/person/PersonJourneyCard.tsx` → `commitEdit`**
   - Expand `notifyDataChanged` call so the `intro_owner` branch also invalidates `intros_run`, `dashboard-metrics`, `lead-measures`, `sa-sales` (whatever keys those hooks use — verified via `src/lib/data/invalidation.ts`). No UI change.

3. No change to `useDashboardMetrics` aggregation logic — once runs carry the new owner, the SA list and counts recompute correctly.

## Coherence proof (to produce after build)

Before fix snapshot from user's screenshot: Per-SA shows Koa 1/0 and (separately) Danielle Mars drill is empty.

After fix, verify via `read_query`:

- Pick Danielle's original booking id; confirm `intros_booked.intro_owner = 'Grace F'` AND every `intros_run` row with `linked_intro_booked_id = <that id>` has `intro_owner = 'Grace F'`.
- Per-SA Performance for the same date range:
  - Koa: no longer listed (or his row count drops by 1).
  - Grace F: row appears with the ran/sale counts that used to be Koa's / Danielle's.
  - Danielle Mars: drilldown opens and shows the booking now (since she'd no longer appear in the table unless she owns other runs).
- Cross-page: Pipeline row, CoachView card, and WIG Per-SA all show Grace F as owner for the same booking.
- All agree: yes.
