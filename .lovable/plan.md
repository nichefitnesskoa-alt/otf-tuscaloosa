## Plan: fix Nathan showing 0% on WIG Coach Stats

### What I found

- The attached screenshot is the WIG Coach Stats table, not the Studio `PerCoachTable` that was patched earlier.
- The WIG row still calculates per-coach close rate as:
  - `closes / coached` when `coached > 0`
  - `0` when `coached === 0`
- Real DB verification found Nathan’s current row is a total-journey close:
  - Member: Summer Falls
  - Root first intro: `1f9b6e27-548b-4956-8a68-ce9b1b30bf9d`
  - Root coach: Nathan
  - Root class date: 2026-05-26
  - 2nd intro sale run: `76b3de5d-9a6a-4c80-8ee2-30c564ef528f`
  - Buy date: 2026-06-01
  - Sale run coach: Natalya
- Because the sale counts in the current WIG date range by buy date, but Nathan has 0 first-intro coached rows in that range, WIG needs the same fallback rule as Studio: if `coached === 0 && closes > 0`, display `100%`.

### Implementation

1. Update `src/pages/Wig.tsx` only.
2. Change the Coach Stats row close-rate calculation from:
  - `wk.coached > 0 ? closes / coached : 0`
   to:
  - `wk.coached > 0 ? closes / coached : closes > 0 ? 100 : 0`
3. Leave all bucketing, sale detection, commission, attribution, and DB data unchanged.
4. Keep the existing total-journey explainer text because it already explains why a coach can show more closes than intros ran.

### Verification after implementation

- Query the same Nathan/Summer Falls DB rows again to confirm no data changed.
- Confirm WIG Coach Stats row values become:
  - Nathan: Coached 0, Closes 1, Close % 100%
- Confirm WIG totals stay:
  - Coached 2, Closes 2, Close % 100%
- Confirm Studio `PerCoachTable` already matches the same rule.
- Final response will include the required COHERENCE PROOF block with DB rows and cross-page numbers.  
  
Make sure every other page and situation like this uses the sam e