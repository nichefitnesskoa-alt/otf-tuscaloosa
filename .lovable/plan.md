

## Fix AMC Date Accuracy and Future-Proof the Logic

### Problem

Three date issues in the `amc_log` table, plus a systemic bug in `incrementAmcOnSale` that causes all entries to use "today" instead of the actual sale date:

| Entry | Current logged_date | Correct date | Source field |
|---|---|---|---|
| Initial AMC entry | 2025-02-11 | 2026-02-11 | Typo (wrong year) |
| Abby Foster | 2026-02-11 | 2026-02-10 | `date_closed = 2026-02-10` |
| Hannah Glasscock | 2026-02-12 | 2026-02-13 | `buy_date = 2026-02-13` |

### Root Cause

`incrementAmcOnSale` always uses `format(new Date(), 'yyyy-MM-dd')` as the `logged_date`. This means the AMC entry gets today's date rather than the actual sale date. For real-time logging this is usually fine, but for follow-up purchases (where `buy_date` may differ from today) or backfills, it produces wrong dates.

### Plan

**Step 1: Fix the 3 incorrect dates in the database**

Run SQL updates to correct:
- Initial entry: `2025-02-11` to `2026-02-11`
- Abby Foster: `2026-02-11` to `2026-02-10`
- Hannah Glasscock: `2026-02-12` to `2026-02-13`

**Step 2: Add optional `saleDate` parameter to `incrementAmcOnSale`**

Update `src/lib/amc-auto.ts` to accept an optional 4th parameter `saleDate?: string`. When provided, use it as `logged_date` instead of today. This ensures follow-up purchases log under their actual `buy_date`.

**Step 3: Pass the actual sale date from all call sites**

| File | What to pass |
|---|---|
| `src/components/FollowupPurchaseEntry.tsx` | `purchaseDate` (the buy_date from the form) |
| `src/pages/ShiftRecap.tsx` (intro runs) | `shiftDate` (the shift recap date) |
| `src/pages/ShiftRecap.tsx` (outside-intro sales) | `shiftDate` |
| `src/components/admin/ClientJourneyPanel.tsx` | `purchaseData.date_closed` or today |
| `src/components/dashboard/InlineIntroLogger.tsx` | Today (real-time logging, no change needed) |

### Technical Details

**`src/lib/amc-auto.ts`** - Add optional `saleDate` param:
```typescript
export async function incrementAmcOnSale(
  personName: string,
  membershipType: string,
  createdBy: string,
  saleDate?: string, // NEW: optional, falls back to today
): Promise<void> {
  const logDate = saleDate || format(new Date(), 'yyyy-MM-dd');
  // ... use logDate instead of today
}
```

**`src/components/FollowupPurchaseEntry.tsx`** - Pass `purchaseDate`:
```typescript
await incrementAmcOnSale(client.memberName, membershipType, staffName, purchaseDate);
```

**`src/pages/ShiftRecap.tsx`** - Pass `shiftDate` for both intro runs and outside-intro sales (the shift date is the date the sale actually occurred).

**`src/components/admin/ClientJourneyPanel.tsx`** - Pass the `date_closed` from the purchase form.

No other files or database schema changes needed. The 3 SQL date corrections are one-time fixes; the code changes prevent future mismatches.

