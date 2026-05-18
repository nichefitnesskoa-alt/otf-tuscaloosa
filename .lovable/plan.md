## 1. Per-staff tab/feature permissions (Staff Management)

Add a `permissions` JSONB column to the `staff` table holding a map of feature keys → boolean. When a value is missing, fall back to the current role-based default so nothing breaks for existing staff.

Feature keys (matches what's actually in BottomNav + key sections):
- `nav.my_day`, `nav.coach_view`, `nav.studio`, `nav.wig`, `nav.own_it`, `nav.vips`, `nav.my_intros`, `nav.pipeline`, `nav.admin`
- `feature.coaching_scripts` (the Workout Templates / Coaching Scripts section in Coach View)
- `feature.scripts_tab` (Scripts tab in My Day)

In `StaffManagement.tsx`, add an "Edit Permissions" button on each row that opens a dialog with a checkbox per feature key, pre-checked from the role default. Saving writes the JSONB.

In `BottomNav.tsx` and `CoachView.tsx` (and the Scripts tab in My Day), replace the current role checks with a small helper `canSee(user, key)` that reads `user.permissions[key]` if present, else falls back to the existing role logic. Koa is always allowed everything regardless.

## 2. Restrict Coaching Scripts to Koa + Jackson

Two surfaces show coaching scripts today:
- `src/pages/CoachView.tsx` line 269 — "Workout Templates With Class Times" section, currently shown to `isAdmin || isCoachLike`
- `src/components/coach/CoachingScripts.tsx` — the component itself

Gate the section to: `user.name === 'Koa' || user.name === 'Jackson'`. Once #1 ships this becomes a per-staff toggle (`feature.coaching_scripts`) seeded `true` only for Koa and Jackson, but the hard-coded gate goes in now so it's correct immediately.

## 3. Vivian's 8:45 intro not showing as "ran" in Studio

What I found in the DB:

- Booking `5de3306c…` — Vivian Shanlever, 2026-05-18 08:45, coach Koa, `booking_status_canon = SECOND_INTRO_SCHEDULED`
- Run `dcb644d2…` — linked to that booking, `result_canon = SECOND_INTRO_SCHEDULED`, `intro_owner = Madison`, `coach_name = Koa`, `ignore_from_metrics = false`
- A 2nd intro `6aea1af3…` was correctly booked for 2026-05-26 with Nathan

By our own canon (`didIntroActuallyRun` in `src/lib/canon/introRules.ts`), `SECOND_INTRO_SCHEDULED` IS a ran intro — the member showed up and chose to book a 2nd intro. So she should be counted in Per-SA, Per-Coach, funnel, and WIG.

Most likely culprit: a Studio widget that filters on a narrower list than `didIntroActuallyRun` (for example checking `result_canon === 'SHOWED'` or excluding `SECOND_INTRO_SCHEDULED` directly). I want to confirm exactly where she's missing before changing logic, because changing the wrong filter would inflate other numbers.

I need one quick clarification before I touch this — see the question below.

## Technical notes

- Migration: `alter table staff add column permissions jsonb not null default '{}'::jsonb;`
- `useActiveStaff` and `AuthContext` must select the new column so `user.permissions` is available.
- Admin (Koa) bypasses all permission checks.
- No changes to existing data — empty `{}` means "use role defaults", so behavior is unchanged for everyone until Koa edits them.
