

# Admin Section Overhaul: Unified Date Filtering & Metrics Consolidation

## Overview

This plan addresses several requests for the Admin section:
1. Add a global date range filter for the entire Overview tab
2. Add a "Recap" section showing booked intros that were shown (with show rates by SA)
3. Exclude "Online Intro Offer" from top performer categories and booker stats in Studio
4. Remove the standalone Payroll Export section (keep CSV in Pay Period Commission)
5. Remove the "vs avg" column from Coach Impact on Closing
6. Consolidate/merge Team Performance with Pay Period Commission (they're redundant)

---

## Changes Summary

| Section | Action |
|---------|--------|
| Admin Overview | Add global DateRangeFilter at top |
| Payroll Export | Remove (CSV export already exists in Pay Period Commission) |
| Team Performance (All Time) | Remove (redundant with Pay Period Commission) |
| Pay Period Commission | Enhance with date range filter support + show rate stats |
| Coach Performance | Remove "vs avg" column |
| Booker Stats / Leaderboards | Exclude "Online Intro Offer" lead source from metrics |
| New: Booking Show Rate by SA | Add section showing intros booked that showed, per SA |

---

## Technical Changes

### 1. `src/pages/Admin.tsx`

**A. Add global date filter state at top of Overview tab**

Import and use `DateRangeFilter` component with state for preset and custom range. Pass the computed `dateRange` to all child components.

```typescript
// Add state
const [datePreset, setDatePreset] = useState<DatePreset>('pay_period');
const [customRange, setCustomRange] = useState<DateRange | undefined>();

// Computed date range
const dateRange = useMemo(() => {
  return getDateRangeForPreset(datePreset, customRange);
}, [datePreset, customRange]);
```

**B. Remove PayrollExport component**

Delete the import and usage of `<PayrollExport />` since Pay Period Commission already has CSV export.

**C. Remove Team Performance section**

Delete the entire Card with "Team Performance (All Time)" since it's redundant with Pay Period Commission.

**D. Update component props**

Pass `dateRange` to:
- `PayPeriodCommission` (new prop)
- `CoachPerformance` (already has dateRange prop)

---

### 2. `src/components/PayPeriodCommission.tsx`

**A. Add optional dateRange prop for filtering**

When a `dateRange` prop is provided, use it instead of the pay period selector. When null, show the pay period dropdown.

**B. Add Booking Show Rate section**

Add a new section showing:
- SA Name
- Intros Booked (count of bookings where `booked_by` = SA)
- Intros Showed (count that have linked runs with non-no-show result)
- Show Rate (%)

This replaces the redundant Team Performance data and adds the requested show rate metrics.

**C. Filter out "Online Intro Offer" from show rate stats**

Exclude bookings where `lead_source` is "Online Intro Offer (self-booked)" from the booking stats calculation, consistent with the project's self-booked exclusion rules.

---

### 3. `src/components/dashboard/CoachPerformance.tsx`

**A. Remove "vs avg" column**

Remove the TableHead and TableCell for the "vs avg" comparison column. Keep the Studio Average badge in the header for reference.

Lines to remove:
- Line 223: `<TableHead className="text-center">vs Avg</TableHead>`
- Lines 233-235: The TableCell with `getPerformanceBadge()`
- Lines 146-152: The `getPerformanceBadge` function (no longer needed)

---

### 4. `src/hooks/useDashboardMetrics.ts`

**A. Filter "Online Intro Offer" from booker stats and leaderboards**

Update the bookerCounts calculation to exclude bookings where `lead_source === 'Online Intro Offer (self-booked)'`.

This affects:
- `bookerStats` array (shown in Booker Stats table)
- `topBookers` leaderboard
- `topShowRate` leaderboard

The existing `firstIntroBookingsNoSelfBooked` filter already excludes based on `booked_by`, but we also need to exclude by lead source.

---

## UI Changes

### Admin Overview Tab (After)

```text
┌────────────────────────────────────────────────────────┐
│ Admin Panel                                            │
│ Manage data sync, edit records, and view team stats    │
├──────────┬──────────┬──────────┬──────────────────────┤
│ Overview │ Data     │ GroupMe  │ Health               │
├──────────┴──────────┴──────────┴──────────────────────┤
│                                                        │
│ [Date Range Filter: This Week ▼]  Viewing: Feb 2-8    │ ← NEW
│                                                        │
│ ┌────────────────────────────────────────────────────┐│
│ │ 💰 Pay Period Commission                           ││
│ │ ─────────────────────────────────────────────────  ││
│ │ Total Commission: $112.50                          ││
│ │ [Export CSV]                                       ││
│ │                                                    ││
│ │ By Intro Owner:                                    ││
│ │  Lauren  $45.00  (5 sales)  ▼                      ││
│ │  Bri     $37.50  (5 sales)  ▼                      ││
│ │  ...                                               ││
│ │                                                    ││
│ │ ─────────────────────────────────────────────────  ││
│ │ 📅 Booking Show Rates (NEW)                        ││ ← NEW
│ │  SA    │ Booked │ Showed │ Show %                  ││
│ │  Grace │   5    │   4    │  80%                    ││
│ │  Katie │   3    │   2    │  67%                    ││
│ └────────────────────────────────────────────────────┘│
│                                                        │
│ ┌────────────────────────────────────────────────────┐│
│ │ 🏋️ Coach Impact on Closing                         ││
│ │  Coach │ Intros │ Sales │ Close %                  ││ ← vs Avg REMOVED
│ │  Bre   │   8    │   5   │  63%                     ││
│ └────────────────────────────────────────────────────┘│
│                                                        │
│ ❌ REMOVED: Payroll Export                             │
│ ❌ REMOVED: Team Performance (All Time)                │
└────────────────────────────────────────────────────────┘
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/pages/Admin.tsx` | Add date filter, remove PayrollExport, remove Team Performance section |
| `src/components/PayPeriodCommission.tsx` | Add dateRange prop, add show rate section, filter Online Intro Offer |
| `src/components/dashboard/CoachPerformance.tsx` | Remove "vs avg" column |
| `src/hooks/useDashboardMetrics.ts` | Filter Online Intro Offer from booker stats/leaderboards |

---

## Date Preset Options

The global date filter will include these presets (matching existing Dashboard patterns):
- This Week, Last Week
- This Month, Last Month
- MTD (same as This Month)
- YTD (same as This Year)
- Pay Period, Last Pay Period
- Custom Range
- All Time

---

## Summary

This consolidates the Admin Overview into a cleaner, date-filterable view:
- One global date picker controls all metrics
- Pay Period Commission becomes the central performance view (with show rates added)
- Removes redundant Team Performance and Payroll Export sections
- Coach Performance loses the vs avg column (keeps studio average badge)
- Online Intro Offer excluded from booker stats consistently

