
# Exclude Run-first Entry + Add Sortable Columns to Show Rate Table

## Problem

1. **Run-first entry showing in stats**: When an intro is run without a prior booking, the system auto-creates a placeholder booking with `booked_by: 'Run-first entry'`. These should not count toward any SA's show rate stats.

2. **Table not sortable**: The Booking Show Rates table is currently fixed (sorted by show rate descending). Users want to sort by any column.

---

## Technical Changes

### File: `src/components/PayPeriodCommission.tsx`

**1. Add "Run-first entry" to exclusion list (line 223)**

```typescript
// Current:
const EXCLUDED_NAMES = ['TBD', 'Unknown', '', 'N/A', 'Self Booked', 'Self-Booked', 'self booked', 'Self-booked'];

// Updated:
const EXCLUDED_NAMES = ['TBD', 'Unknown', '', 'N/A', 'Self Booked', 'Self-Booked', 'self booked', 'Self-booked', 'Run-first entry'];
```

**2. Add sort state for the show rate table**

Add new state to track which column is being sorted and in which direction:

```typescript
const [showRateSort, setShowRateSort] = useState<{
  column: 'saName' | 'booked' | 'showed' | 'showRate';
  direction: 'asc' | 'desc';
}>({ column: 'showRate', direction: 'desc' });
```

**3. Add sorting function**

Create a memoized sorted list based on the current sort state:

```typescript
const sortedShowRateStats = useMemo(() => {
  return [...showRateStats].sort((a, b) => {
    const aVal = a[showRateSort.column];
    const bVal = b[showRateSort.column];
    const cmp = typeof aVal === 'string' 
      ? aVal.localeCompare(bVal as string) 
      : (aVal as number) - (bVal as number);
    return showRateSort.direction === 'asc' ? cmp : -cmp;
  });
}, [showRateStats, showRateSort]);
```

**4. Update table headers to be clickable**

Add click handlers and sort indicators to each TableHead:

```typescript
<TableHead 
  className="cursor-pointer hover:bg-muted/50"
  onClick={() => handleShowRateSort('saName')}
>
  SA Name {showRateSort.column === 'saName' && (showRateSort.direction === 'asc' ? '↑' : '↓')}
</TableHead>
```

**5. Add sort handler function**

```typescript
const handleShowRateSort = (column: typeof showRateSort.column) => {
  setShowRateSort(prev => ({
    column,
    direction: prev.column === column && prev.direction === 'desc' ? 'asc' : 'desc'
  }));
};
```

**6. Update help text (line 434-436)**

```typescript
// Current:
<p className="text-xs text-muted-foreground mt-2">
  Excludes "Online Intro Offer" bookings
</p>

// Updated:
<p className="text-xs text-muted-foreground mt-2">
  Excludes "Online Intro Offer" and "Run-first entry" bookings
</p>
```

---

## UI Changes

### Show Rate Table (After)

```text
┌─────────────────────────────────────────────────────────────┐
│ 📅 Booking Show Rates by SA                                 │
├──────────────────┬──────────┬──────────┬───────────────────┤
│ SA Name ↕        │ Booked ↕ │ Showed ↕ │ Show % ↓          │ ← Clickable headers
├──────────────────┼──────────┼──────────┼───────────────────┤
│ Grace            │    5     │    4     │    80%            │
│ Katie            │    3     │    2     │    67%            │
│ ...              │   ...    │   ...    │    ...            │
└──────────────────┴──────────┴──────────┴───────────────────┘
Excludes "Online Intro Offer" and "Run-first entry" bookings
```

- Clicking a column header sorts by that column
- Clicking again toggles ascending/descending
- Current sort column shows ↑ or ↓ indicator

---

## Summary

| Change | Location |
|--------|----------|
| Add "Run-first entry" to EXCLUDED_NAMES | Line 223 |
| Add `showRateSort` state | After line 70 |
| Add `sortedShowRateStats` memo | After line 261 |
| Add `handleShowRateSort` function | After line 262 |
| Make TableHead elements clickable | Lines 411-416 |
| Use sortedShowRateStats in render | Line 419 |
| Update help text | Lines 434-436 |

This ensures Run-first entries are excluded from SA performance metrics and allows flexible sorting of the show rate table.
