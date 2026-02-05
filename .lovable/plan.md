

# Comprehensive Data Consistency Audit & Fix Plan

## Executive Summary
I've conducted a deep investigation and identified **7 critical data inconsistencies** that explain why Bri's $22.50 commission is missing from the Pay Period Commission component, and uncovered additional systemic issues.

---

## Issue #1: Bri's Missing Commission (CRITICAL)

### Root Cause
**PayPeriodCommission.tsx uses a completely broken query logic.**

Looking at lines 76-91 of `PayPeriodCommission.tsx`:

```typescript
// The query has TWO major problems:

// Problem A: .or() chaining doesn't work as intended
.or(`run_date.gte.${startDate},buy_date.gte.${startDate}`)  
.or(`run_date.lte.${endDate},buy_date.lte.${endDate}`)

// Problem B: For sales_outside_intro, it queries by pay_period_start/end
.gte('pay_period_start', startDate)
.lte('pay_period_end', endDate)
```

**Why Bri is missing:**
1. Bri's 3 sales in `sales_outside_intro` have `date_closed = NULL` and `pay_period_start/end = NULL`
2. The query filters by `pay_period_start >= startDate` which excludes NULL values
3. Even Lauren's runs would fail the broken .or() query logic

### Database Evidence
```
Bri's sales:
- date_closed: NULL (not set when sale created!)
- pay_period_start: NULL
- pay_period_end: NULL
- commission_amount: $7.50 each (3 sales = $22.50)
```

---

## Issue #2: Sales Not Setting date_closed (CRITICAL)

### Root Cause
When sales are logged via `ShiftRecap.tsx` (lines 502-515), **`date_closed` is never set**:

```typescript
await supabase.from('sales_outside_intro').insert({
  sale_id: saleId,
  sale_type: 'outside_intro',
  member_name: sale.memberName,
  lead_source: sale.leadSource || 'Source Not Found',
  membership_type: sale.membershipType,
  commission_amount: sale.commissionAmount,
  intro_owner: user?.name || null,
  shift_recap_id: shiftData.id,
  // MISSING: date_closed: date  <-- Should use the shift date!
});
```

This breaks:
- PayrollExport.tsx (queries by date_closed)
- Any pay period filtering logic

---

## Issue #3: PayrollExport vs PayPeriodCommission Inconsistency (HIGH)

### Two Different Query Strategies
| Component | intros_run Query | sales_outside_intro Query |
|-----------|------------------|---------------------------|
| PayrollExport.tsx | `buy_date` in range + commission > 0 | `date_closed` in range |
| PayPeriodCommission.tsx | Broken .or() on run_date/buy_date | `pay_period_start/end` in range |

Neither matches the dashboard metrics logic in `useDashboardMetrics.ts`, causing different totals everywhere.

---

## Issue #4: Dashboard Commission vs Admin Commission Mismatch (HIGH)

### Dashboard Logic (useDashboardMetrics.ts)
```typescript
// Uses membership result detection + run_date OR buy_date fallback
const saleDate = run.buy_date || run.run_date;
const isMembershipSale = result includes 'premier', 'elite', 'basic';
```

### PayPeriodCommission Logic
```typescript
// Uses commission_amount > 0 check only
.gt('commission_amount', 0)
```

These will produce different results for edge cases.

---

## Issue #5: Today's Race Uses commission_amount, Not Membership Detection (MEDIUM)

In `useDashboardMetrics.ts` lines 380-382:
```typescript
if (run.commission_amount && run.commission_amount > 0) {
  existing.sales++;
}
```

But elsewhere, sales detection uses `isMembershipSale()`. This inconsistency can cause discrepancies in "Today's Race" vs Leaderboards.

---

## Issue #6: Unlinked Manual Entry Creates Duplicate Data Sources (MEDIUM)

When an intro run is manually entered without linking:
1. A booking is auto-created (good for data integrity)
2. But if the SA also enters a "Sales Outside Intro" for the same member, you get duplicates

This is exactly what happened with Lauren's double-counted commission earlier.

---

## Issue #7: Pay Period Fields Never Populated (LOW-MEDIUM)

`sales_outside_intro` has `pay_period_start` and `pay_period_end` columns, but they're never set:
- ShiftRecap.tsx doesn't calculate/set them
- No background job populates them
- PayPeriodCommission tries to query by these empty fields

---

## Recommended Fixes

### Fix 1: Update ShiftRecap.tsx to Set date_closed
```typescript
await supabase.from('sales_outside_intro').insert({
  ...existingFields,
  date_closed: date,  // ADD: Use the shift date as date_closed
});
```

### Fix 2: Rewrite PayPeriodCommission.tsx Query Logic
Replace the broken .or() chains with proper date range logic:
```typescript
// For intros_run: Use COALESCE logic (buy_date or run_date)
const { data: runs } = await supabase
  .from('intros_run')
  .select('intro_owner, sa_name, commission_amount, run_date, buy_date')
  .gt('commission_amount', 0);

// Filter in JS for proper date range logic
const filteredRuns = (runs || []).filter(run => {
  const saleDate = run.buy_date || run.run_date;
  if (!saleDate) return false;
  return saleDate >= startDate && saleDate <= endDate;
});

// For sales_outside_intro: Use date_closed OR created_at fallback
const { data: sales } = await supabase
  .from('sales_outside_intro')
  .select('intro_owner, commission_amount, date_closed, created_at');

const filteredSales = (sales || []).filter(sale => {
  const saleDate = sale.date_closed || sale.created_at?.split('T')[0];
  if (!saleDate) return false;
  return saleDate >= startDate && saleDate <= endDate;
});
```

### Fix 3: Backfill Existing Data
Run a one-time SQL update to populate date_closed from created_at for existing records:
```sql
UPDATE sales_outside_intro 
SET date_closed = DATE(created_at)
WHERE date_closed IS NULL;
```

### Fix 4: Unify Sales Detection Logic
Create a shared utility function used everywhere:
```typescript
// In src/lib/sales-detection.ts
export const isMembershipSale = (result: string): boolean => {
  const lower = (result || '').toLowerCase();
  return ['premier', 'elite', 'basic'].some(m => lower.includes(m));
};

export const getSaleDate = (
  buyDate: string | null, 
  runDate: string | null, 
  dateClosed: string | null,
  createdAt: string
): string => {
  return buyDate || dateClosed || runDate || createdAt.split('T')[0];
};
```

### Fix 5: Align All Components
Update these files to use the shared utility:
- `src/hooks/useDashboardMetrics.ts`
- `src/components/PayPeriodCommission.tsx`
- `src/components/admin/PayrollExport.tsx`

---

## Technical Implementation

### Files to Modify
| File | Changes |
|------|---------|
| `src/pages/ShiftRecap.tsx` | Add `date_closed: date` when inserting sales |
| `src/components/PayPeriodCommission.tsx` | Rewrite query logic with proper date filtering |
| `src/components/admin/PayrollExport.tsx` | Add fallback to created_at if date_closed is null |
| `src/lib/sales-detection.ts` (NEW) | Create shared utility for date/sale detection |
| `src/hooks/useDashboardMetrics.ts` | Import and use shared utility |

### Database Update Required
Backfill existing sales with date_closed values.

---

## Impact Summary

| Issue | Severity | User Impact |
|-------|----------|-------------|
| Bri's missing $22.50 | CRITICAL | Commission not counted in pay period |
| date_closed never set | CRITICAL | All future outside-intro sales invisible |
| Query logic inconsistency | HIGH | Different totals across Admin vs Dashboard |
| Membership detection mismatch | MEDIUM | Edge cases show wrong numbers |
| Duplicate data risk | MEDIUM | Potential double-counting |

This fix will ensure all commission sources (intro runs AND outside-intro sales) are properly counted with consistent logic across the entire application.

