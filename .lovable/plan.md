&nbsp;

Edit 1: Lint guardrail.

After the canonical helper exists, add a custom ESLint rule (or codeowners check) that flags any file containing result_canon === 'SALE' outside of src/lib/intros/close-detection.ts and src/lib/sales-detection.ts. The rule’s error message points to the canonical helper. Costs maybe 10 minutes to add. Saves the next regression entirely.

If a custom rule is too heavy, an alternative: a CI grep check that fails the build when the pattern appears outside the allowed files. Same effect, simpler.

Edit 2: Verification numbers in writing.

Their verification step says “FV tiles must read 3 closed.” Lock the exact expected numbers into the test or the deploy checklist before merging:

	•	This month, Koa: 3 closed, avg score closed = (Madison’s self-eval + Mike’s self-eval + Joyce’s self-eval) / 3

	•	This month, James: whatever the WIG header shows (Lovable to look up before deploy)

	•	This month, studio total: matches WIG header studio total exactly

If any number doesn’t match the WIG header to the integer after the fix ships, the bug isn’t fully resolved. Document the expected numbers in the PR description so the verification is binary, not subjective.

## Root cause (confirmed against live data)

The WIG header and the new First Visit Experience section run two different "is this intro a sale?" checks. They disagree on Koa's month.

**Koa's 5 ran first intros this month (live DB):**


| Member             | result_canon      | Membership? |
| ------------------ | ----------------- | ----------- |
| Elizabeth Williams | `ON_5_CLASS_PACK` | no          |
| Madison Sullivan   | `BASIC`           | yes (close) |
| Sophia Tabor       | `PLANNING_TO_BUY` | no          |
| Mike Shelton       | `PREMIER`         | yes (close) |
| Joyce Busch        | `PREMIER`         | yes (close) |


**WIG header (`src/pages/Wig.tsx` line 476)** counts a close when:

```
r.result_canon === 'SALE' || isMembershipSale(r.result)
```

`isMembershipSale` matches `premier | elite | basic` in the result string. → 3 closes. ✅

**FV section (`src/hooks/useFvTrendData.ts` line ~95)** counts a close when:

```
const sale = r.result_canon === 'SALE';
```

None of Koa's runs have `result_canon = 'SALE'` (they're `PREMIER`/`BASIC`), so → 0 closes. ❌

That single line is the entire bug. The screenshot ("0 closed / 3 didn't close / Self eval only 0/3 / Unscored 0/9") is the exact output of that broken check.

## Other diffs found between the two implementations


| Concern                                                                      | WIG header                                        | FV hook                                                           | Action                                                                                   |
| ---------------------------------------------------------------------------- | ------------------------------------------------- | ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| First-intro filter (`!originating_booking_id || referred_by_member_name`)    | same                                              | same                                                              | keep                                                                                     |
| Date scope                                                                   | `class_date` in range                             | `class_date` in range                                             | keep — match                                                                             |
| VIP / ignore_from_metrics / DELETED_SOFT exclusion                           | yes                                               | yes                                                               | keep                                                                                     |
| Excluded run results                                                         | `NO_SHOW`, `UNRESOLVED`, `VIP_CLASS_INTRO`        | `NO_SHOW`, `UNRESOLVED`, `VIP_CLASS_INTRO`, `PLANNING_RESCHEDULE` | match WIG (drop `PLANNING_RESCHEDULE` from exclusion — Wig counts it as a ran non-close) |
| Sale detection                                                               | `result_canon='SALE' || isMembershipSale(result)` | `result_canon='SALE'` only                                        | **fix — use canonical helper**                                                           |
| Total Journey (2nd intro chain via `originating_booking_id`)                 | yes, same sale check                              | yes, but only `result_canon='SALE'`                               | **fix — use canonical helper**                                                           |
| Coach attribution (VIP session coach override via `vip_sessions.coach_name`) | yes                                               | no — uses run/booking coach only                                  | leave as-is for FV section (per-coach trend, not commission); document                   |


## What to build

### 1. New canonical helper — `src/lib/intros/close-detection.ts`

Source of truth. Two small pure functions plus a batch resolver. One-line comment at top: *"Source of truth for 'did this intro close.' Every consumer uses this. No second implementation anywhere."*

```ts
// Pure predicate on a single intros_run row
export function isCloseRun(run: { result_canon?: string|null; result?: string|null }): boolean

// Given a set of first-intro booking IDs, returns Set<bookingId> that closed
// (handles direct sale on the booking's runs + Total Journey via 2nd intro chain).
export async function resolveClosedFirstIntroIds(
  firstIntroBookingIds: string[]
): Promise<Set<string>>
```

`isCloseRun` body: `result_canon === 'SALE' || isMembershipSale(result || '')`.

`resolveClosedFirstIntroIds` consolidates the batched intros_run + chained 2nd-intro lookup that exists today in both places.

### 2. Refactor `src/hooks/useFvTrendData.ts`

- Remove the inline `ran` / `childSales` / `secondRunSaleSet` blocks.
- After loading the valid first-intro bookings, call `resolveClosedFirstIntroIds(ids)` once and use the returned Set to build the per-coach `RanFirstIntro[]`.
- Use `isCloseRun` to gate which runs count as "ran" (we still need the run row to know the coach).
- Drop `PLANNING_RESCHEDULE` from the `RAN_EXCLUDED` set so the FV "ran" denominator matches WIG.

### 3. Refactor `src/pages/Wig.tsx` (Closing Coach section)

Replace the inline batched-fetch block (lines ~408–485) with a call to `resolveClosedFirstIntroIds`. Keep the VIP coach override there (it's WIG-specific commission attribution).

### 4. Audit other consumers

Grep for `isMembershipSale`, `result_canon === 'SALE'`, `result_canon = 'SALE'`. Touch every file that re-derives "closed" for first-intro Total Journey reporting and route it through the helper. Files I expect to update or verify:

- `src/components/scorecard/WigFirstVisitSection.tsx` (reads from the hook — no change needed)
- `src/components/admin/CoachingView.tsx` (verify; only swap if it's doing Total Journey close detection)
- `src/components/meeting/ObjectionSection.tsx` (verify)
- `src/hooks/useDashboardMetrics.ts`, `useLeadMeasures.ts` (verify)

`src/lib/sales-detection.ts` stays — it remains the lowest-level membership-name predicate that the new helper composes.

### 5. Tests

- New `src/lib/intros/__tests__/close-detection.test.ts` covering: direct `SALE`, `PREMIER`/`BASIC`/`ELITE` via `result`, no-show excluded, 2nd-intro Total Journey close, mixed runs (sale wins).
- Update any existing tests that mocked the old inline logic.

### 6. Verification before shipping

Run three date ranges (this month, last month, current pay period) and assert FV `closingTiles.closedCount` per coach equals WIG header `coachData[coach].closes`. For Koa this month the FV tiles must read **3 closed**, avg score · closed = average of his 3 self-eval scores for Madison/Mike/Joyce.

## Files touched (expected)

- new: `src/lib/intros/close-detection.ts`
- new: `src/lib/intros/__tests__/close-detection.test.ts`
- edited: `src/hooks/useFvTrendData.ts`
- edited: `src/pages/Wig.tsx`
- possibly edited (after audit): `src/components/admin/CoachingView.tsx`, `src/hooks/useDashboardMetrics.ts`, `src/hooks/useLeadMeasures.ts`

## Confirmed values

- **Canonical close check today**: `r.result_canon === 'SALE' || isMembershipSale(r.result)` in `src/pages/Wig.tsx` (Closing Coach section). Not currently exported — will be extracted.
- **Date scope**: `class_date` in range. Both WIG header and FV hook already agree on this; we keep it.