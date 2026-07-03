## The bug

Brent Rogers chain (member has 3 rows):

- Jun 23 · Nathan · root · ran (SECOND_INTRO_SCHEDULED)
- Jun 25 · Nathan · child of Jun 23 · NO_SHOW
- **Jul 3 · Koa · child of Jun 23 · PREMIER (sale)**

With WIG scoped to **July only**, the user is seeing:

1. **Internal · Total Journey → Coach table** credits **Koa** for the Brent close. It should credit **Nathan** (the coach who ran the first intro in the chain).
2. **OTF Corporate · Last Coach** correctly credits Koa for the close, but Koa also gets **+1 in Coached** for the Jul 3 class — that pulls her denominator up for a 2nd intro. OTF Corporate scores on the **first visit only**; a member's second, third, etc. intros must not appear in any coach's Coached column.

## Root cause (Internal · Total Journey)

In `src/pages/Wig.tsx`, the cross-period buy-date backfill for closes uses `resolveRoot(startId)` to walk `originating_booking_id` up to the chain root. For July-only, Jul 3 is the only in-range Brent row and is picked up by that backfill. Two problems combine to make the walk stop at Jul 3 instead of Jun 23:

- `**candidateChildren` filter (line 354)** excludes any child that has `referred_by_member_name` set, so Jul 3 is never considered for orphan/root resolution even though it's clearly a chain child (has `originating_booking_id`).
- `**resolveRoot` (line 648-676)** breaks the walk if the parent isn't in `bookingByIdMap` and the parent fetch returns a row whose *own* `booking_status_canon` (`SECOND_INTRO_SCHEDULED`) or missing runs cause `parentActuallyRan` to evaluate against runs never loaded. The result is that for a Brent-shaped chain (root ran with `SECOND_INTRO_SCHEDULED`, single sale-child has `referred_by_member_name`), the walk halts on the child and TJ credits Koa.

Net effect: TJ close for Brent lands on Koa, exactly the symptom Koa (the user) reported.

## Root cause (OTF Corporate)

In the Corporate `Coached` pass (line 756-778) we iterate **every** in-range booking whose run actually ran, including 2nd-intro children. Koa's Jul 3 class is a 2nd intro for Brent; it must not add to Koa's Coached. OTF corporate rule: **coaches are only scored on the member's first visit**. Corporate `Closes` (last-coach attribution) is separate and stays as-is.

## The fix

**File: `src/pages/Wig.tsx**`

### 1. Total Journey — always walk to true chain root

- Remove the `!b.referred_by_member_name` guard from `candidateChildren` (line 354). A booking with `originating_booking_id` set is *always* a chain child — an inherited `referred_by_member_name` on a rebooked class doesn't change that.
- Harden `resolveRoot` (line 648-676) so the parent walk continues as long as: parent booking exists, is not soft-deleted, is not `DELETED_SOFT` / `RESCHEDULED`, and either (a) has no runs loaded yet — in which case we fetch parent runs on demand instead of treating "no runs cached" as "didn't run" — or (b) has at least one run where `didIntroActuallyRun(r)` is true. This fixes the Brent case (root Jun 23 has a `SECOND_INTRO_SCHEDULED` run — which IS a ran intro).
- Ensure `bookingByIdMap` is seeded with the resolved root before `resolveCloseCoach` reads `root.coach_name`, so `cName` for the buy-date backfill becomes **Nathan** for Brent.

### 2. Corporate — Coached counts first visits only

In the Corporate Coached pass (line 756-778), replace `allCoachBookings.forEach` with a filter that restricts to **first-intro bookings only** (reuse the same `firstIntroBookings` set already computed for Internal above, or the shared `isFirstIntroForMetrics` helper). Corporate `Closes` (line 866-919) stays as-is — sale is still re-attributed to the coach of the latest ran class in the chain (Koa for Brent).

### 3. Extract the chain-root walker

`resolveRoot` currently lives inline inside a 200-line function. Move it to `src/lib/intros/journey.ts` next to the existing chain helpers as `resolveChainRoot(bookingId, { bookingByIdMap, runsByBookingId, fetchBooking, fetchRuns })`, and call it from Wig.tsx. Any future consumer (Studio close-rate, Per-Coach page, commission) reuses the same walker instead of reinventing it.

### 4. Tests

Add a test in `src/lib/intros/__tests__/journey.test.ts` for the exact Brent shape:

- root ran with `SECOND_INTRO_SCHEDULED`
- child A: NO_SHOW
- child B: PREMIER + `referred_by_member_name` set
Assert `resolveChainRoot(childB) === root`.

## Coherence proof (to produce during build)

Query with July-only date range:

```sql
-- Brent's 3 rows
SELECT id, class_date, coach_name, originating_booking_id, booking_status_canon
FROM intros_booked WHERE member_name = 'Brent Rogers' AND deleted_at IS NULL;
```

Then verify in-app:

- **Internal · TJ hero tile** — total closes unchanged, Brent's sale is inside it.
- **Internal · TJ coach table** — Nathan Closes +1 for Brent; Koa Closes -1 for Brent (Koa should have 0 Brent credit here).
- **Corporate · Last Coach hero tile** — total closes unchanged.
- **Corporate coach table** — Koa Closes still +1 for Brent (last-coach rule preserved); Koa Coached **no longer** includes Jul 3 (denominator drops by 1 for the Brent 2nd-intro row); Nathan Coached unchanged for July (Jun 23 is out of range).
- Drilldown on Nathan's TJ Closes row shows Brent Rogers with `via: 2nd_intro`.
- Drilldown on Koa's Corporate Closes row shows Brent Rogers (last-coach).
- Drilldown on Koa's Corporate Coached row does **not** show Brent Rogers.

Sums check: `sum(Corp closes) === sum(TJ closes)` still holds.

## Files touched

- `src/pages/Wig.tsx` — TJ walk fix, Corporate denominator = first intros only, call shared root walker.
- `src/lib/intros/journey.ts` — new `resolveChainRoot` helper (extracted from Wig).
- `src/lib/intros/__tests__/journey.test.ts` — Brent-shape regression test.

## Out of scope

- SOML, referrals, FV Scorecard tiles — untouched.
- Commission attribution (already goes to `intro_owner`, not coach).
- Per-SA tables (unchanged; SA attribution is a separate axis from coach).  
  

  It should show a booked intro ran under Koa in OTF corporate. Koa doesn't need a first visit scorecard though because he coached brent on a 2nd intro not a first and we only do a FVS on the first intro
    
  so Nathan should have 4 intros coached instead of 3 and 1 sale in total journey and OTF corporate  
    
  Koa should not have anything at the moment in total journey cause he didn't coach a 1st intro this month  
