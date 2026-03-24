

# Conversion Funnel: Only Count Ran Intros, Not Future Bookings

## Problem
The funnel's "Booked" column includes future bookings (class_date hasn't happened yet), inflating the count and skewing percentages. For example, 11 "Booked" but 0 "Showed" because those intros haven't occurred yet.

## Changes

### 1. Filter out future bookings (`ConversionFunnel.tsx`)
- In `computeFunnelBothRows`, filter `firstBookings` and `secondBookings` to only include bookings where `class_date <= today` (the intro date has passed)
- This prevents future-scheduled intros from appearing in the funnel or drill-down
- The pull-forward logic already handles cross-period sales, so this won't break anything

### 2. Rename "Booked" → "Ran" in the funnel UI
- Since we're now only showing intros that have actually occurred, rename the first column from "Booked" to "Ran" to match the Per-SA table terminology
- Update `FunnelRow` default labels: "Booked" → "Ran"
- Update drill sheet category labels: "Booked" → "Ran"
- Update Total Journey sub-labels: "1st Booked" → "1st Ran"
- Update subtitle text

### 3. Filter drill-down people lists
- `bookedPeople` arrays should also only contain past-date intros (they're derived from the same filtered arrays, so this happens automatically)

## Files Changed

| File | Change |
|------|--------|
| `src/components/dashboard/ConversionFunnel.tsx` | Add `class_date <= today` filter; rename all "Booked" labels to "Ran" |

## Technical Detail

```typescript
const today = format(new Date(), 'yyyy-MM-dd');

const firstBookings = activeBookings.filter(b =>
  isFirstBooking(b) && isInRange(b.class_date, dateRange || null) && b.class_date <= today
);
const secondBookings = activeBookings.filter(b =>
  !isFirstBooking(b) && isInRange(b.class_date, dateRange || null) && b.class_date <= today
);
```

Label changes in `FunnelRow` and the main render:
- Default `bookedLabel` → "Ran"
- `bookedLabel="1st Booked"` → `"1st Ran"`
- Drill category label map: `booked: 'Ran'`

