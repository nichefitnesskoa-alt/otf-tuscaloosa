## Changes

### 1. Remove Admin tabs

In `src/pages/Admin.tsx`:
- Remove from `adminSections` array: `analytics`, `coaching`, `bookings`, `10x`
- Remove their `<TabsContent>` blocks (Analytics combo, Coaching, Bookings/PipelinePage, 10x Exercise)
- Remove now-unused imports: `IntelligenceTab`, `RecapsPage`, `ReportsPage`, `CoachingView`, `PipelinePage`, `TenXExercise`, plus icons (`Brain`, `BarChart3`, `CalendarDays` if unused elsewhere on page, `Zap`)
- Keep all other tabs intact (Overview, Objections, Data, Referrals, Stories, Scripts, Hiring, Staff Management, Shifts)

### 2. Fix dual-role staff insert

**Root cause:** `staff.role` has check constraint `role IN ('SA','Coach','Admin')`, but the StaffManagement form offers "Both" as a value, which the DB rejects.

**Fix:** Migration to expand the check constraint to include `'Both'`:

```sql
ALTER TABLE public.staff DROP CONSTRAINT staff_role_check;
ALTER TABLE public.staff ADD CONSTRAINT staff_role_check
  CHECK (role = ANY (ARRAY['SA','Coach','Both','Admin']));
```

`useActiveStaff` already treats `'Both'` as both Coach and SA, so no further code changes needed.

## Coherence check

- `useActiveStaff.ts` filters coaches via `['Coach','Both','Admin']` and SAs via `['SA','Both','Admin']` — supports `'Both'` already.
- No other tables reference removed Admin tab content; routes for `/meeting`, `/scripts`, `/pipeline`, etc. remain accessible separately.
- Pipeline still reachable at `/pipeline` for Admin/SA via existing nav.

## Files touched

- `src/pages/Admin.tsx` (remove 4 tabs + imports)
- New migration: alter `staff_role_check` constraint
