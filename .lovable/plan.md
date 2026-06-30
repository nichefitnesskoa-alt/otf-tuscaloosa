# Two Studio Close Rate Tiles on /wig (Coach tab)

Today there's one "Studio Close Rate" tile at the top of the Coach tab, and below it two coach tables: **Internal · Total Journey** and **Corporate · Last Coach**. The tile uses the Total Journey rule only, which doesn't match the corporate table below it.

Add a second studio-level tile so the top of the page mirrors the two tables.

## What the user sees

Two tiles stacked (or side-by-side on wide screens) above the Coach Stats tables:

1. **Studio Close Rate — Internal · Total Journey**
   - Numerator: ran 1st intros in range whose journey chain ended in a SALE
   - Denominator: ran 1st intros in range
   - One-line rule: "Credit follows the 1st-intro coach. Any sale in the chain = close."
   - Keeps the existing target + edit-target control.

2. **Studio Close Rate — Corporate · Last Coach**
   - Numerator: members whose **last** ran intro in range ended (chain) in a SALE
   - Denominator: every ran intro in range (1st + 2nd), same universe as the Corporate coach table's "Coached" sum
   - One-line rule: "OTF corporate logic. Every class counts; close credit follows the last coach."
   - Same target slider (or its own — see Q1).

Each tile keeps the existing visual: big % + target + progress bar + "at/above/below target" caption.

## Numbers must agree with the tables directly below

- Internal tile **closes** = sum of `Closes` column in the Internal coach table.
- Internal tile **denominator** = sum of `Coached` column in the Internal coach table.
- Corporate tile **closes** = sum of `Closes` column in the Corporate coach table.
- Corporate tile **denominator** = sum of `Coached` column in the Corporate coach table.

Both totals are already computed in `Wig.tsx` as `coachTableTotals` and `coachTableTotalsCorporate`, so the tiles read straight from those — no new aggregation, guaranteed coherence.

## Files touched

- `src/pages/Wig.tsx` — replace the single tile with two tiles wired to `coachTableTotals` (Internal) and `coachTableTotalsCorporate` (Corporate). Keep the existing `wigTarget` for Internal; see Q1 for Corporate target.
- No new helpers needed — both numerators/denominators already exist in state from the previous turn.

## Coherence proof I'll produce when done

- DB: count ran 1st intros + chain-sale closes for June 2026 → matches Internal tile.
- DB: count all ran intros + last-coach chain-sale closes for June 2026 → matches Corporate tile.
- Cross-page: Internal tile % == sum of Internal table Close% weighted; Corporate tile % == same for Corporate table.

## One open question

**Q1 — Target for the Corporate tile?** The Internal tile already has a 40% target with an Edit control. For the Corporate tile, do you want: (a) the same 40% target shared, (b) its own separate editable target, or (c) no target shown (just the %)?
