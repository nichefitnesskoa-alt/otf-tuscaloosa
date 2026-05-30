## Problem

Stacia Donovan's record has `result_canon = ELITE` with `buy_date = 2026-06-01` (post-dated). Today is May 30, but she's already showing as a closed sale everywhere — in pipeline, WIG, commission, close rate, recaps, etc.

Sale-date filtering already respects `buy_date` (via `getRunSaleDate` → `isSaleInRange`), so a date-ranged report for "May" correctly excludes her. But anywhere the code asks "is this run a sale?" without a date filter (status badges, labels, pipeline tabs, Total Journey close detection, "all-time" counts, today's activity feed), she shows as sold immediately.

## Fix — canonical post-dated guard

Add one helper in `src/lib/sales-detection.ts`:

```ts
// True when a sale exists in the data but the buy_date is in the future (CST).
export function isPostDatedSale(run, asOf = getNowCentral()): boolean
export function isEffectiveSale(run, asOf = getNowCentral()): boolean
  // = isSaleCanon(result_canon) && !isPostDatedSale(run)
```

Then route every "is this a sale right now?" check through `isEffectiveSale` so post-dated rows behave as "Pending Sale" until their buy_date arrives.

### Files to update

1. **`src/lib/sales-detection.ts`** — add `isPostDatedSale` + `isEffectiveSale`. Update `isSaleInRange` to additionally require `buy_date <= range.end` (already implicit via sale-date, but make explicit).
2. **`src/lib/intros/resultLabels.ts`** — `labelForRun` returns new `'Pending Sale'` label when post-dated; `isCloseResult` returns false for post-dated.
3. **`src/lib/intros/close-detection.ts` / `journey.ts`** — Total Journey `isClosed` excludes post-dated runs so close rate / WIG don't count Stacia until June 1.
4. **`src/features/pipeline/selectors.ts`** — post-dated rows stay in pipeline (not moved to "closed/sold" bucket) until buy_date.
5. **`src/components/dashboard/*` activity & recap surfaces** — post-dated sales hidden from "today's sales" feeds; surfaced in a small "Post-Dated (queued for June 1)" badge on the row.
6. **`src/lib/outcomes/commissionRules.ts` consumers / `PayPeriodCommission.tsx`** — commission amount is still stored on the row, but `isSaleInRange` already pins it to the pay period containing buy_date, so no change needed beyond verifying it doesn't leak into the current period.
7. **UI badge** — wherever a sale row is rendered (pipeline row card, MyDay intro card, recap details), show an amber "Post-Dated · June 1" pill instead of the green SALE pill until the buy_date is reached.

### Behavior after the fix

- **Today (May 30):** Stacia shows as "Pending Sale · buys June 1" — not counted in close rate, WIG sales, today's commission, today's activity, or pipeline "sold" bucket.
- **June 1 onward:** Automatically flips to a normal SALE everywhere (no manual action). Commission lands in the June pay period.

### Verification

- Query: Stacia's row pre/post June 1 — confirm `isEffectiveSale` flips on 6/1 CST.
- WIG close rate for current week excludes Stacia; week of June 1 includes her.
- Per-SA Lead Measures: her intro_owner's "sales" count drops by 1 today, returns on 6/1.
- Pipeline Sales tab does not list her until 6/1.
- Recap for May 30 does not include her sale; recap for June 1 does.
- No regression on normal same-day sales (buy_date <= today).

### Out of scope

- No DB migration. No schema change. No edit to her record — `buy_date = 2026-06-01` is already correct.
