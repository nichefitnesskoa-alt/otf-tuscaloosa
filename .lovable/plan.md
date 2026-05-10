**EDITS**

**1. Fix the AuthContext "Both" role mapping. This is the big one.** Lovable's plan says Both → Admin-level access. You just said no. Update:

```
'Both' role in staff table → user sees UNION of Coach + SA tabs and pages.
Specifically: My Day, Studio, WIG (full visibility per prior wave), 
Coach View, Text My Intros, Pipeline, VIPs.
NOT visible: Admin tab, Admin sub-pages, Staff Management.
Admin tab is gated to user.email = Koa's email only, not by role.
```

This means change the AuthContext mapping, not just Georgia's row. Any future Both-role staff inherits the same correct behavior.

**2. Verify Koa stays the only Admin.** After the role change, search for every `role === 'Admin'` check in the codebase. Confirm none of them get satisfied by 'Both'. Admin gating should be by specific user identity (email or hardcoded id), not by role string. Otherwise Georgia accidentally inherits Admin powers six months from now when someone forgets.

**3. The Planning-to-Buy fix needs one addition.** Plan covers the constraint, the un-archive (no-op), and the comment. Add a guard in the application code: in `useFollowUpData.ts` or wherever the cleanup function lives, hardcode an exclusion list of person_types that can never be auto-archived. Right now it's just `planning_to_buy`. Future-proofs against another agent writing a cleanup script that doesn't read your comment.

```
const NEVER_ARCHIVE_PERSON_TYPES = ['planning_to_buy'];
```

Reference that constant in any cleanup logic. Comment alone isn't a guard.  
  
Five small fixes

### 1. Remove "Open coach page →" link

File: `src/components/scorecard/CoachDashboard.tsx` (lines 83–90). Delete the `<a>` next to the picker. The picker stays.

### 2. Koa sees "Text My Intros" tab

File: `src/components/BottomNav.tsx`. Koa logs in as `Admin` (per `AuthContext`), but the admin nav array (lines 76–84) doesn't include `/my-intros`. Add `{ path: '/my-intros', label: 'Text My Intros', icon: UserCheck }` to the admin items list (between Coach View and Admin feels natural).

### 3. Georgia in COACHES + SAS lists

File: `src/types/index.ts` (lines 12–13).

- Add `'Georgia'` to `COACHES` (so she appears in the WIG Coach Stats dropdown, scorecard pickers, intro coach pickers, etc.).
- Add `'Georgia'` to `SALES_ASSOCIATES` (so she shows in SA pickers / leaderboards).
- DB already has her as `staff.role = 'Both'` and `is_active = true` — no DB change needed. `AuthContext` maps `Both` → Admin-level access, which means she'll log in with full access (matches Koa pattern). Flag this so user can confirm: **CONFIRM: Georgia logs in with Admin-level access (same as Koa) — say so if you'd rather she sign in as a regular Coach.**

### 4. Delete Team Meeting card + Follow-up Ownership panel from Admin

File: `src/pages/Admin.tsx`.

- Remove the Team Meeting `<Card>` block (lines 587–599) on the Overview tab.
- Remove `<FollowUpOwnershipPanel />` (line 612).
- Remove now-unused imports: `FollowUpOwnershipPanel`, `useMeetingAgenda`, `getCurrentMeetingMonday`, `CalendarDays` (if not used elsewhere on the page — verify), and the `format` import only if no other call site remains.

Out of scope: leave `/meeting` route, `Meeting.tsx`, `useMeetingAgenda.ts`, and the `meeting/` components in place (they're feature code that may be reused). Just removing the Admin entry-point card per the user's ask. If the user wants the meeting feature fully removed too, they can say so and I'll do a follow-up sweep.

### 5. Keep Planning-to-Buy follow-ups active forever

Audit result: the prior pre-May cleanup archived **517 rows** across `no_show`, `didnt_buy`, `planning_reschedule`, `book_2nd_intro_day2/day7`. **Zero `planning_to_buy` rows exist** in `follow_up_queue` today, so nothing to restore. The database `CHECK` constraint on `person_type` doesn't currently list `planning_to_buy` either — meaning today's code at `useFollowUpData.ts:123` queries for it but the DB cannot accept inserts of that type.

Two-part fix:

a. **Add `'planning_to_buy'` to the `person_type` check constraint** so future inserts succeed. Migration:

```
ALTER TABLE public.follow_up_queue DROP CONSTRAINT follow_up_queue_person_type_check;
ALTER TABLE public.follow_up_queue ADD CONSTRAINT follow_up_queue_person_type_check
  CHECK (person_type = ANY (ARRAY[
    'no_show','didnt_buy','planning_reschedule',
    'book_2nd_intro_day2','book_2nd_intro_day7','planning_to_buy'
  ]));
```

b. **Defensive un-archive**: any `planning_to_buy` row in the Pre-May cleanup batch gets reactivated (no-op today since count is 0, but locks the rule in for future runs):

```
UPDATE public.follow_up_queue
SET status = 'pending', closed_reason = NULL
WHERE person_type = 'planning_to_buy'
  AND closed_reason LIKE 'Pre-May%';
```

c. **Prevent any future bulk cleanup from touching them.** There is no scheduled cleanup job — the pre-May archive was a one-time SQL run by an agent. Procedurally: any future cleanup script must include `AND person_type <> 'planning_to_buy'`. I'll add a comment in `useFollowUpData.ts` near the planning_to_buy block stating this rule so the next agent sees it.

### Files touched

- `src/components/scorecard/CoachDashboard.tsx`
- `src/components/BottomNav.tsx`
- `src/types/index.ts`
- `src/pages/Admin.tsx`
- `src/features/followUp/useFollowUpData.ts` (one-line comment)
- New migration: planning_to_buy constraint + un-archive

No changes to: meeting feature itself, AuthContext role mapping, scorecard logic.