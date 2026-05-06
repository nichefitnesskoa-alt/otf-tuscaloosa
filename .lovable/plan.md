## Remove inactive staff from all dropdowns

### Root cause
Every dropdown sources from static arrays in `src/types/index.ts` (`COACHES`, `SALES_ASSOCIATES`, `ALL_STAFF`) — these still include deactivated staff (Alex, Bre, Bri, Elizabeth, Grace, Kailey, Kaitlyn H, Katie, Kayla, Sophie). The `staff.is_active` flag in the DB is the source of truth but the static arrays aren't synced to it. Fixing the arrays fixes every dropdown in one change (Scorecard coach picker, Outcome drawer, IntroBookingEntry, IntroRunEntry, Walk-in, BookIntro, FollowUps, OutcomeDrawer, VipScheduler, VipRegistrations, ConvertVipToIntro, IntroCard inline editor, etc.).

### Active staff (per DB `staff.is_active = true`)
- **Coaches**: Jackson, James, Koa, Natalya, Nathan
- **SAs**: Jayna, Kaiya, Koa, Lauren, Madison, Nora

### Changes

**1. `src/types/index.ts`** — replace the two arrays with active-only lists:
```ts
export const COACHES = ['Jackson', 'James', 'Koa', 'Natalya', 'Nathan'] as const;
export const SALES_ASSOCIATES = ['Jayna', 'Kaiya', 'Koa', 'Lauren', 'Madison', 'Nora'] as const;
```
Add a comment noting these mirror `staff.is_active = true` and must be updated when staff are activated/deactivated.

**2. `src/features/pipeline/components/PipelineSpreadsheet.tsx` (line 585)** — local `ALL_STAFF` hard-coded list also includes deactivated staff. Replace with imported `ALL_STAFF` from `@/types` (or a fresh active-only list) so it stays consistent.

### Out of scope
- Historical records still reference deactivated staff (e.g., past intros coached by Bre). Display of historical names is unaffected — only NEW selections drop the inactive options. This matches the requested behavior.
- Login screen: `AuthContext` already filters by `is_active = true` against the staff table on login lookup, and the login picker uses the staff table directly — no change needed there.

### Downstream effects (all auto-fixed by the array change)
- Scorecard Coach + Evaluator dropdowns → active only
- OutcomeDrawer coach pickers (intro coach, 2nd intro coach, ran-by) → active only
- IntroBookingEntry / IntroRunEntry / Walk-in / BookIntro / InlineIntroLogger → active only
- FollowUpsDueToday coach assign → active only
- VipSchedulerTab + VipRegistrationsSheet + ConvertVipToIntroDialog → active only
- IntroCard inline coach editor → active only
- CoachScorecards page picker → active only

### Future-proofing note
Long-term the right fix is to drive these dropdowns off `useActiveStaff()` (already exists, queries `staff.is_active`). That's a larger refactor touching ~15 components. For this prompt, syncing the canonical arrays delivers the user's ask immediately and keeps a single update point.
