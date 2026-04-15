<final-text>Root cause from the code audit:

1. "Planning to Reschedule" is not part of the canonical outcome/status model.
   - `src/lib/domain/outcomes/types.ts` has no `PLANNING_RESCHEDULE` result/status mapping.
   - `src/components/myday/OutcomeDrawer.tsx` special-cases it outside `applyIntroOutcomeUpdate`.
   - That means reschedule writes and My Day readers are not using one shared source of truth.

2. My Day filtering is inconsistent.
   - `src/features/myDay/useUpcomingIntrosData.ts` correctly hides `PLANNING_RESCHEDULE`.
   - But `src/features/myDay/useWinTheDayItems.ts` still pulls raw `intros_booked` rows for today/tomorrow without excluding reschedule status.
   - `src/features/myDay/MyDayPage.tsx` counts/metrics also still count raw bookings without excluding `PLANNING_RESCHEDULE`.
   - So someone can disappear from the Intros list but still show elsewhere in My Day.

3. There is likely bad live data on Ryann Bulger specifically.
   - Since you said this happened multiple times, I need to inspect her bookings/runs/follow-up rows and correct any stale ACTIVE booking(s) that should be `PLANNING_RESCHEDULE` or otherwise closed out.

Plan to fix it:

1. Inspect Ryann Bulger’s live records first
   - Check all `intros_booked`, `intros_run`, and `follow_up_queue` rows for her.
   - Identify whether the issue is:
     - a stale ACTIVE booking,
     - multiple duplicate bookings,
     - or a row marked `PLANNING_RESCHEDULE` that is still leaking into My Day through the wrong reader.

2. Canonicalize the reschedule outcome path
   - Update `src/lib/domain/outcomes/types.ts` so `Planning to Reschedule` is recognized canonically.
   - Refactor `src/components/myday/OutcomeDrawer.tsx` so reschedule uses the shared outcome/status pipeline instead of a one-off write path.
   - Ensure repeated reschedule logging is idempotent and always leaves booking status in a consistent state.

3. Fix every My Day reader that shares the root cause
   - `src/features/myDay/useWinTheDayItems.ts`
     - exclude `PLANNING_RESCHEDULE` from questionnaire, prep, confirmation, and outcome tasks.
   - `src/features/myDay/MyDayPage.tsx`
     - exclude `PLANNING_RESCHEDULE` from counts and unresolved metrics.
   - `src/features/myDay/useUpcomingIntrosData.ts`
     - keep the exclusion, but align it to the same shared status logic and Central Time helpers.

4. Repair the bad data
   - Correct Ryann Bulger’s affected booking row(s).
   - If I find the same corruption pattern on other rows created by this same bug, I will fix those too in the same pass.

5. Verify intended behavior
   - `Planning to Reschedule` should disappear from all My Day active surfaces and only live in Follow-Up.
   - A true rebooked ACTIVE intro should still appear on its new scheduled date.
   - Follow-Up reschedule tab must still show the person correctly.
   - My Day counts and checklist items must match the corrected status.

Affected files:
- `src/lib/domain/outcomes/types.ts`
- `src/components/myday/OutcomeDrawer.tsx`
- `src/features/myDay/useWinTheDayItems.ts`
- `src/features/myDay/MyDayPage.tsx`
- `src/features/myDay/useUpcomingIntrosData.ts`

Downstream effects I will cover in the same build:
- Intros tab visibility
- Win the Day checklist visibility
- My Day summary/counts
- Follow-Up reschedule visibility
- Ryann Bulger live data correction
- Shared canonical reschedule handling so this does not recur</final-text>