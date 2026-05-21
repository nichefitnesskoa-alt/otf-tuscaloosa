
# Fix: WIG Coach Closes must match Studio totalClosed (buy_date anchored)

## The bug (verified with real data)

Kimberly Brown:
- `intros_booked`: `class_date = 2026-04-15`, `coach_name = Koa`, `intro_owner = Kaiya`
- `intros_run` (linked): `result_canon = BASIC`, `buy_date = 2026-05-21`, `run_date = 2026-04-15`, `coach_name = Koa`

With WIG date filter `this_month` (May 1–31, 2026):

| Surface | Counts Kimberly? | Why |
|---|---|---|
| Studio `totalClosed` (Wig.tsx L216–225) | YES | uses `isSaleInRange(r, ...)` which anchors to `buy_date` (May) per [Metric Date Anchoring](mem://logic/reporting/metric-date-anchoring) |
| Coach "Closes" drill-down (Wig.tsx L350–620) | NO | only fetches `intros_booked` where `class_date BETWEEN range_start AND range_end`. Kimberly's April class is excluded from `firstIntroBookings`, so her run is never inspected for the per-coach close map |

So the top metric reads 1, the drill-down reads 0 — same data point, two answers. Violates the workspace coherence rule and the "Anchor sales to buy_date" core rule.

## Fix

In `src/pages/Wig.tsx` `loadLeadMeasures`, augment per-coach close attribution with a second pass anchored to `buy_date` so closes match the studio top-line exactly:

1. **New query** after the existing first-intro pull, restricted to membership sale runs whose `buy_date` falls in `rangeStart..rangeEnd`:
   ```ts
   const { data: saleRunsByBuy } = await supabase
     .from('intros_run')
     .select('id, linked_intro_booked_id, coach_name, result, result_canon, buy_date, run_date, created_at')
     .in('result_canon', ['SALE','PREMIER','PREMIER_OTBEAT','ELITE','BASIC'])
     .gte('buy_date', rangeStart)
     .lte('buy_date', rangeEnd);
   ```
   This is the same canonical sale set the studio uses; we just use `buy_date` as the bucket.

2. **Resolve each sale to a first-intro booking + coach**, mirroring existing logic:
   - Fetch the linked `intros_booked` row (batched `.in('id', ...)`) if not already in `bookingByIdMap`.
   - Walk `originating_booking_id` upward to find the root first intro (Total Journey, matches existing 2nd-intro credit path at L498–588). Reuse the helper pattern already in `resolveJourneyChainsForBookings` so we don't duplicate logic — or inline a small batched parent lookup since we only need the root booking row for VIP/lead_source.
   - Coach = `resolveCloseCoach(rootBooking, run.coach_name)` (same VIP override already in place).
   - Skip if `result_canon === 'VIP_CLASS_INTRO'` (already excluded today).
   - Skip if `isBookingExcludedFromMetrics(rootBooking)` (DELETED_SOFT, ignore_from_metrics, etc.).

3. **Merge into `coachCloseMap` and `attribMap` without double-counting**:
   - Track a `countedRunIds: Set<string>` across both passes. The existing pass at L550–588 adds to this set as it counts. The new pass only counts runs whose id is not already in it.
   - For brand-new closes (intro was outside the period), push into `attribMap[coach].closes` with `via: 'direct'` (or `via: '2nd_intro'` if the run is on a 2nd intro and we credit the originator coach — match existing Total Journey behavior). Use `classDate` from the root booking so the drill-down still shows when the member first came in.
   - Also increment the coach's `closeTotal`/`closed` so close-rate denominator math behaves the same way the existing pass does.

4. **Coached count is NOT changed.** Coached stays anchored to `class_date in range` (that's correct — Koa didn't coach a new intro in May for Kimberly). Per-coach close rate can therefore legitimately exceed coached count in a given month when a prior month's intro converts; that's the same shape the studio already shows and matches the Total Journey definition.

5. **Reconciliation invariant (assert in code via console.warn in dev only, optional)**: after both passes, `sum(coachData.closes) === totalClosed`. If they ever drift, log a diagnostic with the offending booking ids so future regressions are obvious.

## Files touched

- `src/pages/Wig.tsx` — extend `loadLeadMeasures` only. No other files.

No DB changes. No schema changes. No new helper file required (existing journey helper covers the parent-walk if we want; otherwise a 5-line inline lookup is enough).

## Verification

- Reload `/wig` with default `this_month` filter.
- Top "Close rate" card numerator (`coachTableTotals.closes`) should equal `totalClosed` (the studio metric on the same page).
- Open "Koa · Closes" drill-down for May 2026 — Kimberly Brown should appear alongside the existing four sales, total 5.
- Switch filter to April 2026 — Kimberly should NOT appear under closes (her sale buy_date is May), confirming we anchored to `buy_date`, not `class_date` or `run_date`.
- Switch filter to "All time" — counts unchanged.
- Spot-check one VIP Class sale to confirm VIP coach override still works on the new pass.

## Out of scope

- Coach Stats "Coached" column logic (intentional — coached is a class_date metric).
- Studio dashboards (already correct, this fix brings WIG into agreement with them).
- Commission attribution (uses `intro_owner`, separate concern — Kimberly's commission already credits Kaiya correctly).
