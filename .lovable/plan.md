## Root cause

Jaden Cerreta and Ethan Forman both have `intros_booked` rows with `booking_status_canon = 'DELETED_SOFT'` and `deleted_at` set (soft-deleted on May 9). Their `intros_run` rows still exist with `result_canon = 'NOT_INTERESTED'`, coach James.

- **WIG tab (`src/pages/Wig.tsx`)** filters bookings up-front and excludes `DELETED_SOFT`, duplicates, deleted/dead, `is_vip`, and `ignore_from_metrics`. So James's "Coached" drilldown shows 3 — correct.
- **Studio tab (`src/components/dashboard/PerCoachTable.tsx`)** iterates over `introsRun` and only filters by `result_canon` (VIP_CLASS_INTRO/NO_SHOW/UNRESOLVED). It never checks the linked booking's status, so soft-deleted bookings still feed Coached and Closes — James shows 6.

`PerSATable` and `BookerStatsTable` already check `deleted_at` + `is_vip`, so the bug is isolated to `PerCoachTable`. The deeper issue is that this filter is duplicated as ad-hoc inline checks in 4+ files, which is exactly how Studio drifted from WIG.

## Fix

### 1. Add a single source of truth for "is this booking excluded from metrics?"

New file `src/lib/intros/excludedBookings.ts`:

```ts
export function isBookingExcludedFromMetrics(b: any): boolean {
  if (!b) return true;
  if (b.is_vip) return true;
  if (b.ignore_from_metrics) return true;
  if (b.deleted_at) return true;
  const status = (b.booking_status_canon || '').toUpperCase();
  if (status === 'DELETED_SOFT') return true;
  if (status.includes('DUPLICATE') || status.includes('DELETED') || status.includes('DEAD')) return true;
  return false;
}
```

Add a unit test in `src/lib/intros/__tests__/excludedBookings.test.ts` covering each branch (DELETED_SOFT, deleted_at present, is_vip, ignore_from_metrics, duplicate-status, clean booking, null) so future schema drift fails CI.

### 2. Wire the helper into `PerCoachTable.tsx` (the bug fix)

In the `useMemo`:
- Build `excludedBookingIds = new Set(introsBooked.filter(isBookingExcludedFromMetrics).map(b => b.id))`.
- In the `firstIntroRuns` filter, also drop any run whose `linked_intro_booked_id ∈ excludedBookingIds`.
- In the Total-Journey 2nd-intro check, also drop chained 2nd-intro bookings that are excluded.

After this fix, James's Studio Coached drops from 6 → 3, matching WIG. Jaden, Ethan, and Alexa's pre-deletion duplicate booking disappear from the drilldown.

### 3. Replace the inline filters in WIG, PerSATable, and BookerStatsTable with the helper

Same logic, just unified — so the next time someone adds a new "excluded" condition (e.g. a new canon status), every screen picks it up automatically.

- `src/pages/Wig.tsx` — replace the inline `filteredBookings`/`allCoachBookings` filter blocks (≈3 spots) with `isBookingExcludedFromMetrics`.
- `src/components/dashboard/PerSATable.tsx` — replace the `deleted_at + is_vip` block.
- `src/components/dashboard/BookerStatsTable.tsx` — same.

Behavior is unchanged for these three; this is just a refactor preventing future drift.

### 4. Verify with the same query the user saw

After the fix, James's Studio drilldown should match WIG: April Boera (Booked 2nd), Mehmet Kamci (SALE), Sarah Riggins (SALE) — and nothing else.

## Files

**New**
- `src/lib/intros/excludedBookings.ts`
- `src/lib/intros/__tests__/excludedBookings.test.ts`

**Edited**
- `src/components/dashboard/PerCoachTable.tsx` (the actual fix)
- `src/pages/Wig.tsx` (refactor to shared helper)
- `src/components/dashboard/PerSATable.tsx` (refactor)
- `src/components/dashboard/BookerStatsTable.tsx` (refactor)

## Out of scope

- Changing what counts as "excluded" — keeping the exact same rule WIG already uses.
- Touching VIP-coach attribution or close-detection logic.
- Recovering or hard-deleting the soft-deleted bookings (they stay archived for audit).