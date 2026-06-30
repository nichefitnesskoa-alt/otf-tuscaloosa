
## Goal

Add a second **Coach Stats** table on /wig that mirrors how OTF Corporate scores coaches: every class a member attends counts as a "coached" for the coach who ran it, and the close goes to the coach of the **last** class the member attended. The existing Total Journey table stays exactly as-is.

## What you'll see on /wig

Two stacked tables under the existing Coach Stats card:

```text
COACH STATS
────────────────────────────────────────────────────────
[ Internal · Total Journey ]   ← existing table, unchanged
  Coached = 1st intros only. Close credit stays with the
  1st-intro coach, even when a 2nd intro closed it.
  This is how we hold the first impression accountable.

[ OTF Corporate · Last Coach ] ← NEW
  Coached = every intro you personally ran (1st AND 2nd).
  Close credit goes to the coach of the most recent class
  the member attended. Matches corporate reporting.
```

A short rule chip sits above each table. Targets, R/Y/G coloring, Scored/Avg score, and the drill-down dialog work on both.

## Concrete example (Anna Pauley)

Chain: `6/17 ran w/ Koa → 6/30 ran w/ Natalya → SALE`

| Table | Koa | Natalya |
|---|---|---|
| Internal · Total Journey | Coached 1, Closes 1 | Coached 0, Closes 0 |
| OTF Corporate · Last Coach | Coached 1, Closes 0 | Coached 1, Closes 1 |

The 1st intro still counts against Koa as a coached in the corporate table (he ran it), but the close goes to Natalya. Total coached in Corporate ≥ Total coached in Total Journey, because every 2nd-intro run adds another coached row.

## How "Corporate · Last Coach" is computed

1. **Coached denominator** = every booking in range where `didIntroActuallyRun(linkedRun)` is true (1st AND 2nd intros), attributed to the coach who actually ran that specific class (`resolveCloseCoach(booking, runCoach)`). Excludes VIP_CLASS_INTRO, no-show, unresolved, deleted/cancelled — same exclusions used elsewhere.
2. **Close credit** for any sale in range: walk the chain from the sale's booking, find the **latest** booking whose linked run actually ran, credit that coach. Falls back to the sale-run's own coach if nothing in the chain ran (edge case).
3. **Scored / Avg score** key off the same per-class attribution (FV scorecards already belong to the coach who ran that class, so this lines up automatically).
4. **`Closes` count** matches Total Journey's `Closes` total exactly — same sales, just attributed to a different coach.

## Technical changes

- `src/pages/Wig.tsx`
  - In `loadLeadMeasures`, after the existing Total Journey pass, run a second aggregation:
    - Coached: iterate every booking in `showedFirstIntroBookings` AND every 2nd-intro booking already fetched into `secondIntroBookingMap`, filter to those whose linked run satisfies `didIntroActuallyRun`, bucket by `resolveCloseCoach(booking, runCoach)`.
    - Closes: for each sale already collected (`countedRunBookingIds` set + cross-period `buyDateSales`), resolve the **last-ran booking in the chain** with a new `resolveLastRan(rootId)` walker (descends via `originating_booking_id` reverse lookup we already built), credit that coach.
    - Build a parallel `coachAttributionCorporate` map mirroring `CoachAttribution`, including drill rows for both buckets.
  - Store results in new state: `coachLeadMeasuresCorporate`, `coachAttributionCorporate`, `coachTotalsCorporate`.
  - Render a second `<Card>` under the existing one, reusing the same table renderer (extract to a small `<CoachStatsTable>` component to avoid duplication). Header copy per table as shown above.
  - Wire taps on the corporate table to open `CoachAttributionDrillDown` with the corporate attribution map.
- `src/components/dashboard/CoachAttributionDrillDown.tsx`
  - Add `'wig-corporate'` to the `source` prop union. Footer note explains: "Corporate: every class you ran counts as coached; close goes to the coach of the member's last attended class."
- No DB changes. No changes to Studio, Per-Coach (Studio), ConversionFunnel, MyDay, commission, or any other surface. Total Journey remains canonical for internal logic and pay.

## Out of scope

- No change to commission, SA leaderboard, or Studio tab.
- No new editable target — Corporate table reuses `targets.coachClose` for its R/Y/G bar (we can split later if you want a separate corporate target).

## Coherence checks before reporting done

- Sum of `Closes` in Corporate table === sum of `Closes` in Total Journey table for the same range (same sales, redistributed).
- Sum of `Coached` in Corporate table ≥ sum of `Coached` in Total Journey table (extra rows from 2nd intros that actually ran). Difference === count of ran 2nd intros in range.
- Spot-check Anna Pauley: Total Journey credits Koa 1/1; Corporate credits Koa 1/0 and Natalya 1/1.
- Spot-check a chain with a single ran intro and a sale: both tables credit the same coach with the same numbers.
- Spot-check a 2nd intro that didn't close: Corporate adds a coached row to the 2nd coach but no close anywhere.

Confirm and I'll build it.
