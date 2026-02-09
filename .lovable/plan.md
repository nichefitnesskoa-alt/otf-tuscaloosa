

# Fix Timezone Inconsistencies Across the Application

## Problem

Dates are showing inconsistently across different sections of the app:
- Julie Sidlowski shows as **February 7th** in Studio/Recaps sections
- But correctly shows as **February 8th** in Admin

This is a timezone issue where `new Date('2026-02-08')` is interpreted as **UTC midnight**, which becomes **February 7th at 6-8pm** for users in US timezones.

## Root Cause

Database date fields (e.g., `class_date`, `run_date`, `shift_date`) store dates as `YYYY-MM-DD` strings. When these are parsed in JavaScript:

| Method | Interpretation | Result for CST User |
|--------|----------------|---------------------|
| `new Date('2026-02-08')` | UTC midnight | Feb 7, 6pm |
| `parseISO('2026-02-08')` | UTC midnight | Feb 7, 6pm |
| `new Date(2026, 1, 8)` | Local midnight | Feb 8, 12am |

The fix that was already applied to `PayPeriodCommission.tsx` (using local date constructor) needs to be applied consistently across all components.

## Solution

Create a shared utility function in `src/lib/utils.ts` that parses `YYYY-MM-DD` date strings as **local dates** instead of UTC:

```typescript
/**
 * Parse a YYYY-MM-DD date string as local midnight (not UTC)
 * Prevents timezone shift issues when displaying dates
 */
export function parseLocalDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
}
```

Then update all components to use this function.

---

## Files to Modify

### 1. `src/lib/utils.ts`
Add the `parseLocalDate` helper function.

### 2. Display Components (using `format(new Date(...), ...)`)

| File | Line | Current | Fix |
|------|------|---------|-----|
| `src/pages/MyShifts.tsx` | 121 | `format(new Date(recap.shift_date), ...)` | Use `parseLocalDate` |
| `src/components/admin/ShiftRecapsEditor.tsx` | 260, 353, 430 | `format(new Date(...), ...)` | Use `parseLocalDate` |
| `src/components/admin/ShiftRecapDetails.tsx` | 128, 181, 220 | `format(new Date(...), ...)` | Use `parseLocalDate` |
| `src/components/ClientNameAutocomplete.tsx` | 168 | `format(new Date(client.class_date), ...)` | Use `parseLocalDate` |
| `src/components/PayPeriodCommission.tsx` | 281 | `format(new Date(detail.date), ...)` | Use `parseLocalDate` |
| `src/components/dashboard/BookingChainViewer.tsx` | 46 | `format(parseISO(dateStr), ...)` | Use `parseLocalDate` |

### 3. Display Components (using `toLocaleDateString`)

| File | Line | Current | Fix |
|------|------|---------|-----|
| `src/components/dashboard/MembershipPurchasesReadOnly.tsx` | 281 | `new Date(...).toLocaleDateString(...)` | Use `parseLocalDate` |
| `src/components/dashboard/ClientJourneyReadOnly.tsx` | 384 | `new Date(...).toLocaleDateString(...)` | Use `parseLocalDate` |
| `src/components/admin/MembershipPurchasesPanel.tsx` | 286 | `new Date(...).toLocaleDateString()` | Use `parseLocalDate` |

### 4. Date Comparison Components (using `parseISO`)

| File | Line | Issue |
|------|------|-------|
| `src/hooks/useDashboardMetrics.ts` | 85, 395 | `parseISO()` for date range filtering |
| `src/components/dashboard/CoachPerformance.tsx` | 41 | `parseISO()` for date range filtering |

For comparison logic (not display), we need to ensure the date range boundaries are also in local time. The `isWithinInterval` check should work correctly since both the parsed date and the range are created consistently.

---

## Implementation Details

### New Utility Function

```typescript
// src/lib/utils.ts

/**
 * Parse a YYYY-MM-DD date string as local midnight (not UTC)
 * Use this when displaying dates from the database to prevent timezone shift
 */
export function parseLocalDate(dateStr: string): Date {
  if (!dateStr) return new Date(NaN);
  const parts = dateStr.split('T')[0].split('-');
  if (parts.length !== 3) return new Date(NaN);
  const [year, month, day] = parts.map(Number);
  return new Date(year, month - 1, day);
}
```

### Example Update Pattern

**Before:**
```typescript
import { format } from 'date-fns';

// In component:
{format(new Date(recap.shift_date), 'EEEE, MMMM d, yyyy')}
```

**After:**
```typescript
import { format } from 'date-fns';
import { parseLocalDate } from '@/lib/utils';

// In component:
{format(parseLocalDate(recap.shift_date), 'EEEE, MMMM d, yyyy')}
```

---

## Summary of Changes

| Action | Count |
|--------|-------|
| Add utility function | 1 file |
| Update display formatting | 9 files |
| Total lines changed | ~30 lines |

---

## Testing Checklist

After implementation, verify:
- My Shifts page shows correct dates
- Studio Scoreboard / Recaps shows correct dates matching Admin
- Pay Period Commission detail dates are correct
- Client Pipeline dates match across all views
- Members Who Bought dates are consistent
- ShiftRecapsEditor dates in Admin are correct

