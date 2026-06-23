
## What's actually broken

All four issues trace back to the same root: **`intros_run.intro_owner` and `intros_booked.intro_owner` are allowed to drift apart**, and three different edit paths in Pipeline only update one of them. Per-SA Performance is aggregated off `run.intro_owner`, but the drilldown is rendered off `booking.intro_owner` — so the count and the names disagree, and the journey-sale path for 2nd intros makes it worse.

DB-verified examples (current data):

- **Anna Pauley** (`4a0621c1…`) — booking.intro_owner=`Grace F`, booked_by=`Jayna`, run.intro_owner=`Grace F`. The 6/17 run is `SECOND_INTRO_SCHEDULED` (counts as ran). She belongs in **Grace F · Ran = 1** — never under Koa.
- **Stephanie Wang** — 1st booking owned by Madison (no run yet); 2nd booking `95ec34da` ran 6/22 with `BASIC` sale. Per-SA counts the 2nd-intro sale under Madison via run.intro_owner, but the drilldown walks chains from 1st-intro bookings and the date/range can hide it — hence "Madison · 1 ran, no name."
- **Koa · 2 ran** is stale: Koa has 0 first-intro runs in the active range; the 2 is being pulled from `effectiveRan = max(ran, sales)` + 2nd-intro sale counting paths that don't reconcile with the drilldown's 1st-intro-only iteration.

Three different intro_owner write paths today:
1. `PipelineSpreadsheet.tsx:683` inline cell edit — writes only `intros_booked.intro_owner`.
2. `PipelineDialogs.tsx:163` Edit Booking dialog — writes only `intros_booked.intro_owner` (+ `_locked`).
3. `PipelineDialogs.tsx:451` Manage Owner dialog — writes only `intros_booked.intro_owner`.
4. `PipelineDialogs.tsx:254` Edit Run dialog — writes `intros_run.intro_owner` and syncs to booking (only path that does both).
5. `pipelineActions.ts:140` `syncIntroOwnerFromRun` — also does both, but only called from one place.

Result: change owner in any of the first three places → booking shows new owner everywhere (Pipeline card, PersonJourneyCard, Per-SA drilldown) while the run stays on the old owner (Per-SA count, commission, GroupMe). That's exactly the Koa/Grace F symptom.

## Plan

### 1. Single canonical helper for intro_owner changes

Add `setIntroOwnerForJourney(rootBookingId, newOwner, { reason })` in `src/features/pipeline/pipelineActions.ts`. It walks the journey chain (via `resolveJourneyChainsForBookings` / `walkJourneyChain`) and atomically updates:

- `intros_booked.intro_owner` + `intro_owner_locked` on the root **and every 2nd-intro child** in the chain
- `intros_run.intro_owner` on every run linked to any booking in the chain
- Writes an audit row (`edit_reason`, `last_edited_by`, `last_edited_at`)
- Invalidates every React Query key the booking/run reads (introsBooked, introsRun, perSA, perCoach, WIG, commission, follow-up)

Rewire all five edit surfaces to call this helper. Delete the inline `supabase.from('intros_booked').update({ intro_owner })` calls.

### 2. Per-SA aggregation and drilldown read from the same source

In `src/hooks/useDashboardMetrics.ts` (perSA block, lines 262–330) and `src/components/dashboard/PerSATable.tsx` (drillRows, lines 55–112), both must derive ownership from the **chain root's `intros_booked.intro_owner`** — never from `intros_run.intro_owner` and never from `booked_by`/`sa_working_shift` fallbacks for the count.

Concretely:

- Aggregation: group runs by their chain root (use `walkJourneyChain` / `resolveJourneyChainsForBookings`), attribute the chain's ran + sale to `rootBooking.intro_owner`. Drop the `run.intro_owner === saName` filter and the `effectiveRan = max(ran, sales)` fudge — if the chain ran or sold, count exactly that, once.
- Drilldown: iterate the same chain roots filtered by `rootBooking.intro_owner === sa`. Remove the `intro_owner || booked_by || sa_working_shift` fallback so it can't disagree with the count.
- Sale-only contributions from a 2nd intro whose root isn't owned by the same SA now attribute to the root's owner (matches "commission attributes to intro_owner" and "Total Journey: 1st → any sale").

Coherence proof at the end will name the specific rows: Anna Pauley → Grace F (1 ran, 0 sales); Stephanie Wang → Madison (1 ran via journey, 1 sale, name present in drilldown); Koa → 0/0 in the active range (row drops out).

### 3. Drilldown row shows class time

In `PerSATable.tsx` rows.push subtitle (line 105), append `intro_time`:

```
`${format(parseLocalDate(b.class_date), 'MMM d')} · ${formatTime(b.intro_time)}${b.lead_source ? ' · ' + b.lead_source : ''}${journeySale && !directSale ? ' · via 2nd intro' : ''}`
```

Use existing `src/lib/datetime/formatTime.ts` so it renders "4:15 PM".

### 4. "Open in Pipeline" deep-links to the person

- `PersonJourneyCard.tsx:657` already navigates `/pipeline?focus=${booking.id}` but Pipeline ignores the param.
- In `PipelinePage.tsx`, read `?focus=<bookingId>` (and accept `?leadId=` used by Milestones) on mount, resolve to the person, expand that row in `PipelineSpreadsheet`, scroll it into view, and clear the param.
- Add the matching prop wiring on `PipelineSpreadsheet` (`focusBookingId`) — open the row's expand panel and `scrollIntoView({ block: 'center' })`.

### Files to touch

- `src/features/pipeline/pipelineActions.ts` — add `setIntroOwnerForJourney`
- `src/features/pipeline/components/PipelineSpreadsheet.tsx` — use helper; accept `focusBookingId`, expand + scroll
- `src/features/pipeline/components/PipelineDialogs.tsx` — Edit Booking, Manage Owner, Edit Run dialogs all call helper
- `src/features/pipeline/PipelinePage.tsx` — read `?focus=` / `?leadId=`, pass down
- `src/hooks/useDashboardMetrics.ts` — perSA chain-based aggregation
- `src/components/dashboard/PerSATable.tsx` — chain-based drilldown, add intro_time
- `mem://logic/canon-lists/canonical-helpers-registry` — register `setIntroOwnerForJourney`

### Closing proof I'll produce

```
COHERENCE PROOF
- DB verification:
  - Anna Pauley booking 4a06… intro_owner=Grace F, run 9323e79c intro_owner=Grace F (already aligned)
  - Stephanie Wang root 23e07c48 owner=Madison; 2nd intro 95ec34da BASIC sale 6/22 → attributed to Madison
  - Koa June first-intro runs that actually ran = 0
- Cross-page check:
  - Per-SA Koa: 0 ran / 0 sales (row removed)
  - Per-SA Grace F: includes Anna Pauley in Ran drilldown w/ "Jun 17 · 4:15 PM · Event"
  - Per-SA Madison: 1 ran / 1 sale, drilldown shows Stephanie Wang
  - Pipeline owner edit (any of 3 paths) → run.intro_owner matches booking.intro_owner immediately
  - Open in Pipeline from PersonJourneyCard → row expanded + scrolled
- All agree: yes
```

No DB schema changes. No commission math change beyond the attribution being correct again.
