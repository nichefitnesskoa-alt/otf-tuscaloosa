

# Studio Employee Filter, Remove My Stats, Lead Source "Showed"

## Overview

Three changes: (1) make the employee dropdown filter ALL Studio sections (not just the per-SA table), make it visible to all users, and style it prominently; (2) move Individual Activity to My Shifts and remove the My Stats page; (3) add "showed" counts to Lead Source Analytics.

---

## 1. Employee Dropdown Filters Everything in Studio

**Current behavior:** The dropdown only filters the Runner Stats table (`filteredPerSA`). The Studio Scoreboard, Pipeline Funnel, Lead Source, Top Performers, and Booker Stats all ignore it.

**New behavior:** When an SA is selected, ALL sections on the Studio page show only that person's data:
- **Studio Scoreboard** shows that SA's individual metrics (intros run, sales, close %, lead measures)
- **Pipeline Funnel** shows bookings/shows/sales for that SA only
- **Lead Source** filters to bookings by that SA
- **Top Performers** hides (only relevant for studio-wide view)
- **Runner Stats** filters to that SA
- **Booker Stats** filters to that SA

**Make it available to ALL users** (not just admins), so any staff member can view any colleague's scoreboard. Remove the `if (!isAdmin) return null` guard.

**Style the dropdown:** Orange background with black text for high visibility.

### Files changed:
- `src/components/dashboard/EmployeeFilter.tsx` -- remove admin-only guard, apply orange/black styling
- `src/pages/Recaps.tsx` -- compute filtered metrics for all sections when an employee is selected
- `src/hooks/useDashboardMetrics.ts` -- no changes needed (filtering happens at the page level using existing `perSA` and `bookerStats` data)

---

## 2. Remove My Stats Page, Move Activity to My Shifts

Since any user can now view individual scoreboards in Studio, the separate "My Stats" page is redundant.

- **Move** the Individual Activity table into the My Shifts page (below the shift history list)
- **Remove** the `/dashboard` route and "My Stats" nav item from the bottom nav
- **Delete** `src/pages/Dashboard.tsx` (no longer needed)

### Files changed:
- `src/pages/MyShifts.tsx` -- add IndividualActivityTable with date filter, using `useDashboardMetrics` for the logged-in user's activity data
- `src/components/BottomNav.tsx` -- remove the "My Stats" nav item (`/dashboard`)
- `src/App.tsx` -- remove the `/dashboard` route (redirect to `/my-shifts` if anyone hits it)

---

## 3. Lead Source Analytics: Add "Showed" Count

Currently the distribution summary shows `"X booked, Y sold"` per source. Add the showed count between them: `"X booked, Z showed, Y sold"`.

### Files changed:
- `src/components/dashboard/LeadSourceChart.tsx` -- add `showed` to pie data, update summary text and tooltip to display it

---

## Technical Details

### EmployeeFilter.tsx
```typescript
// Remove: if (!isAdmin) return null;
// Add orange styling to SelectTrigger:
<SelectTrigger className="w-40 bg-primary text-primary-foreground border-primary">
```

### Recaps.tsx -- Filtered metrics
When `selectedEmployee` is set, compute individual metrics from `metrics.perSA` for scoreboard, filter pipeline/lead-source from the raw data, and hide Top Performers:

```typescript
// Filtered scoreboard metrics
const scoreboardMetrics = useMemo(() => {
  if (!selectedEmployee) return metrics.studio;
  const sa = metrics.perSA.find(m => m.saName === selectedEmployee);
  if (!sa) return { introsRun: 0, introSales: 0, closingRate: 0, ... };
  return {
    introsRun: sa.introsRun,
    introSales: sa.sales,
    closingRate: sa.closingRate,
    goalWhyRate: sa.goalWhyRate,
    relationshipRate: sa.relationshipRate,
    madeAFriendRate: sa.madeAFriendRate,
  };
}, [selectedEmployee, metrics]);
```

For Pipeline and Lead Source filtering by employee, add a new parameter to `useDashboardMetrics` or filter at the page level by re-computing from the raw booking/run data filtered to the selected SA's `intro_owner`.

### LeadSourceChart.tsx
```typescript
// Add showed to pieData
const pieData = data.map(d => ({
  ...existing,
  showed: d.showed,
}));

// Summary line becomes:
{item.value} booked, {item.showed} showed, {item.sold} sold
```

### MyShifts.tsx
Add below existing shift list:
```typescript
<IndividualActivityTable data={personalActivity} />
```
With a date filter and `useDashboardMetrics` call scoped to the current user.

---

## File Summary

| Action | File |
|--------|------|
| Edit | `src/components/dashboard/EmployeeFilter.tsx` -- remove admin guard, orange styling |
| Edit | `src/pages/Recaps.tsx` -- filter all sections by selected employee |
| Edit | `src/components/dashboard/LeadSourceChart.tsx` -- add "showed" count |
| Edit | `src/pages/MyShifts.tsx` -- add Individual Activity table |
| Edit | `src/components/BottomNav.tsx` -- remove My Stats nav item |
| Edit | `src/App.tsx` -- remove /dashboard route, redirect to /my-shifts |
| Delete | `src/pages/Dashboard.tsx` -- no longer needed |

