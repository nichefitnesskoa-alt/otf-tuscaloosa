

# VIP Recurring Slot Templates & Auto-Generation

## Summary

Add recurring VIP slot templates, a scheduled edge function for auto-generation, week-grouped public page, manual slot management enhancements, and a templates management UI in the Pipeline Scheduler tab.

---

## Database Migration

**1. Create `vip_slot_templates` table:**

```sql
CREATE TABLE public.vip_slot_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  day_of_week integer NOT NULL,
  slot_time time NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.vip_slot_templates ENABLE ROW LEVEL SECURITY;
-- Public CRUD policies (matches existing vip_sessions pattern)
CREATE POLICY "Allow all read vip_slot_templates" ON public.vip_slot_templates FOR SELECT USING (true);
CREATE POLICY "Allow all insert vip_slot_templates" ON public.vip_slot_templates FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all update vip_slot_templates" ON public.vip_slot_templates FOR UPDATE USING (true);
CREATE POLICY "Allow all delete vip_slot_templates" ON public.vip_slot_templates FOR DELETE USING (true);
```

**2. Seed template data** (via insert tool, not migration):

9 rows: Mon 19:00, Tue 19:00, Wed 19:00, Thu 19:00, Fri 17:45, Sat 06:45, Sat 12:00, Sun 08:45, Sun 15:30.

**3. Seed reservation** (via insert tool):

Update the Wed Apr 16 19:00 vip_sessions record (after generation) to `status='reserved'`, `reserved_by_group='Kappa Delta Sorority'`.

---

## Edge Function: `generate-vip-slots`

New edge function at `supabase/functions/generate-vip-slots/index.ts`.

Logic:
1. Fetch all `vip_slot_templates` where `is_active = true`.
2. For each template, compute dates for the next 8 weeks matching `day_of_week`.
3. For each date+time combo, check if a `vip_sessions` record already exists (any status including cancelled — cancelled slots are NOT regenerated).
4. If no record exists, insert a new `vip_sessions` with `status='open'`, `is_on_availability_page=true`, `created_by='system'`, auto-generated `shareable_slug` and `vip_class_name`.

Config in `supabase/config.toml`: `verify_jwt = false`.

**Scheduling:** Use `pg_cron` + `pg_net` to call the function every Monday at 00:00 Central (06:00 UTC). Set up via insert tool (not migration).

**Initial seed:** Call the function immediately after deploy to populate the first 8 weeks.

---

## VipSchedulerTab Enhancements

**File: `src/features/pipeline/components/VipSchedulerTab.tsx`**

Add to existing component:

1. **"Mark Reserved" button** on open slots — opens inline form with group name field. On save: sets `status='reserved'`, `reserved_by_group`.

2. **"Reopen" button** on reserved AND cancelled slots — sets `status='open'`, clears `reserved_by_group` and contact fields.

3. **"Templates" section** below the sessions list:
   - Header: "Recurring Templates" with subtitle "Slots auto-generated every Monday for 8 weeks ahead"
   - List of all `vip_slot_templates` rows showing day name + time.
   - Each row has an active/inactive toggle (`Switch`). Toggling updates `is_active`.
   - Status color: green dot for active, gray for paused.
   - No add/delete template UI in this build — just toggle active state.

4. **Created-by indicator**: Show "System" or staff name in muted text on each slot row so manual one-offs are distinguishable.

---

## Public /vip-availability Page Updates

**File: `src/pages/VipAvailability.tsx`**

1. **Group slots by week**: Add week grouping with headers like "Week of April 14". Use `startOfWeek` from date-fns to bucket sessions.

2. **Show day name**: Each slot card shows "Wednesday, April 16, 2026" format (already does this).

3. All existing claim logic, race protection, realtime — unchanged.

---

## Intros Tab VIP Cards

Already implemented in prior build. No changes needed — reserved `vip_sessions` already appear in My Day/Coach View intros tab.

---

## Files Created/Modified

| File | Action |
|------|--------|
| `supabase/functions/generate-vip-slots/index.ts` | Create |
| `supabase/config.toml` | Add function config |
| `src/features/pipeline/components/VipSchedulerTab.tsx` | Add templates section, mark reserved, reopen |
| `src/pages/VipAvailability.tsx` | Add week grouping |
| Database migration | Create `vip_slot_templates` table |
| Insert tool | Seed templates, set up pg_cron job, seed reservation |

## What Does NOT Change

- VipAvailability claim flow logic
- IntroRowCard VIP rendering
- Pipeline tabs/routing
- Any other page or component

