

# Conversion Funnel & Lead Source: Rename Back to "Booked", Time-Based Filter, Per-SA Fixes

## Summary of Changes

### 1. Rename "Ran" back to "Booked" (Conversion Funnel + Lead Source)
- Change all labels from "Ran" to "Booked" in both `ConversionFunnel.tsx` and `LeadSourceChart.tsx`
- Update drill-down category labels, sort buttons, subtitle text, and rate labels ("ran→sale" → "booked→sale")
- Journey sub-labels: "1st Ran" → "1st Booked"

### 2. Filter by current datetime, not just date (`ConversionFunnel.tsx` + `useDashboardMetrics.ts`)
- Currently uses `b.class_date <= today` (date-only comparison)
- Change to compare against `new Date()` using the booking's `class_date` + `start_time` (if available) so a booking at 3 PM today doesn't appear until after 3 PM
- If no `start_time`, fall back to end-of-day for that date (so it appears once the date has fully passed)
- Apply same logic in `useDashboardMetrics.ts` for lead source "booked" counts

### 3. Total Journey pull-forward fix (`ConversionFunnel.tsx`)
- The journey row uses `first.booked` and `first.showed` but `total.sold`
- When total.sold > 0 but first.booked = 0, apply pull-forward to the journey row itself: `showed = max(first.showed, total.sold)`, `booked = max(first.booked, showed)`
- This makes the journey row show 1/1/1 = 100% when there's 1 total sale but no 1st intros in range

### 4. Remove commission from Per-SA table (`PerSATable.tsx` + `useDashboardMetrics.ts`)
- Remove the "Commission" column from the table header and body
- Remove `commission` from the `SortColumn` type and `PerSAMetrics` interface
- Clean up commission calculation in `useDashboardMetrics.ts` (or just stop passing it)

### 5. Per-SA already excludes no-shows
- Confirmed: the current code at line 246 already filters `if (res === 'no-show' || res === 'no show') return false` — no change needed

## Files Changed

| File | Changes |
|------|---------|
| `src/components/dashboard/ConversionFunnel.tsx` | Rename "Ran"→"Booked" labels; change date filter to datetime-aware; add pull-forward to journey row |
| `src/components/dashboard/LeadSourceChart.tsx` | Rename "Ran"→"Booked" in labels, sort buttons, drill-down |
| `src/hooks/useDashboardMetrics.ts` | Change lead source date filter to datetime-aware; remove commission from perSA |
| `src/components/dashboard/PerSATable.tsx` | Remove Commission column and related sort/type code |

## Technical Detail

**Datetime filter** (replaces `b.class_date <= today`):
```typescript
function hasBookingPassed(b: IntroBooked): boolean {
  const startTime = (b as any).start_time; // e.g. "14:30" or "2026-03-24T14:30:00"
  const [y, m, d] = b.class_date.split('-').map(Number);
  if (startTime) {
    const match = startTime.match(/(\d{1,2}):(\d{2})/);
    if (match) {
      const scheduled = new Date(y, m - 1, d, +match[1], +match[2]);
      return scheduled <= new Date();
    }
  }
  // No start_time: treat as end of day
  return new Date(y, m - 1, d, 23, 59, 59) <= new Date();
}
```

**Journey pull-forward**:
```typescript
const journeyShowed = Math.max(first.showed, total.sold);
const journeyBooked = Math.max(first.booked, journeyShowed);
const journey: FunnelData = {
  booked: journeyBooked,
  showed: journeyShowed,
  sold: total.sold,
  ...
};
```

