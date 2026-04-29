&nbsp;

We also need to determine what other outcomes need to go to the intro never happened outcome as well

## The two real bugs

Looking at Kyle Davis's data confirms both issues come from the same root cause: **Planning to Reschedule is a "the intro never happened" outcome, but the system is treating it like a completed (ran) intro.**

Kyle's actual records:

- Booking 4/27 @ 6:15 with James → status = `PLANNING_RESCHEDULE`
- A run row was created on 4/27 with `result = "Planning to Reschedule"` (this should never have existed — he didn't run)
- Booking 4/29 @ 6:15 with Koa → has `originating_booking_id` pointing to the 4/27 booking, so it gets the "2nd Intro" badge

So we have two visible symptoms and one underlying mistake.

### Bug 1 — Planning to Reschedule is shown in "Intro Runs"

The Pipeline row card lists every row from `intros_run` under "Intro Runs (1)". A row exists for Kyle 4/27 with result `PLANNING_RESCHEDULE`. That row should not be there at all — Planning to Reschedule means the member cancelled before the class and is going to rebook, so no intro was actually run.

### Bug 2 — Kyle's 4/29 booking shows the "2nd" badge

The 2nd-intro detector (`isRealSecondIntro` in `selectors.ts`) only filters out originators that are `NO_SHOW` or soft-deleted. It does not filter out originators with status `PLANNING_RESCHEDULE` or `CANCELLED`. Since Kyle's 4/27 booking is a Planning to Reschedule (the intro never happened), the 4/29 booking is actually his **1st** real intro, not his 2nd.

The "2nd" badge in the row card is even more naive — it just checks `if (b.originating_booking_id)` without checking whether the originator was a real ran intro.

## Canonical rule we're enforcing

**An intro counts as "ran" only if the member actually showed up to a class.** The following result_canon values mean the intro did NOT happen:

- `NO_SHOW`
- `PLANNING_RESCHEDULE`
- `PLANNING_2ND_INTRO` (they're rescheduling to a different date)
- `UNRESOLVED` (no outcome captured yet)

A booking only counts as a "1st intro" for 2nd-intro-chain purposes if it was either:

- Linked to a run with a `SHOWED`-class result (anything that isn't NO_SHOW / PLANNING_RESCHEDULE / PLANNING_2ND / UNRESOLVED), OR
- Has a `booking_status_canon` indicating an actual outcome (`CLOSED_PURCHASED`, `CLOSED_DIDNT_BUY`, `NOT_INTERESTED`, `SHOWED`).

If the originator was `PLANNING_RESCHEDULE`, `CANCELLED`, `NO_SHOW`, or `DELETED_SOFT`, the rebook IS the 1st intro.

## Changes

### 1. `src/lib/canon/introRules.ts` (or a new helper if it doesn't have one)

Add a single shared predicate `didIntroActuallyRun(run)` so every part of the app uses the same rule:

```ts
const NON_RAN_RESULTS = new Set(['NO_SHOW','PLANNING_RESCHEDULE','PLANNING_2ND_INTRO','UNRESOLVED']);
export function didIntroActuallyRun(r: { result_canon?: string|null; result?: string|null }): boolean {
  const canon = r.result_canon || normalizeIntroResult(r.result || '');
  return !NON_RAN_RESULTS.has(canon);
}
```

### 2. `src/features/pipeline/selectors.ts`

- Update `isRealSecondIntro` so the originator is also disqualified when its `booking_status_canon` is `PLANNING_RESCHEDULE`, `CANCELLED`, or `DELETED_SOFT`, OR when it has no run that actually ran. This fixes the 2nd badge being wrong for Kyle.
- Anywhere counts use `journey.runs.length > 0` / `journey.runs.some(r => r.result !== 'No-show')` (the `completed`, `missed_guest`, `no_show`, `second_intro` tab filters/counts), switch to `didIntroActuallyRun(r)` so Planning to Reschedule rows don't make a journey appear "Completed" or push it out of the No-Show tab.

### 3. `src/features/pipeline/components/PipelineRowCard.tsx`

- The "2nd Intro" badge currently uses `b.originating_booking_id` alone. Change it to use `isRealSecondIntro(b, journey)` so it matches the selector's logic.
- In the "Intro Runs" section, hide rows where `didIntroActuallyRun(r)` is false. They aren't real runs — they were created by a follow-up/outcome action and represent the booking's status, not a class attended. We'll keep them in the DB (so commission/audit history is intact) but they don't belong in the "Intro Runs" list. Consider a small "Status events" collapsed section beneath if Koa wants visibility, but default is just hide.

### 4. Investigate why a `Planning to Reschedule` run row was created in the first place

Search every "create run" / "save outcome" path (`OutcomeDrawer`, `applyIntroOutcomeUpdate`, follow-up flows) and confirm: when a user selects Planning to Reschedule (or Cancelled, or anything that means the intro didn't happen), the booking's `booking_status_canon` should be updated **without** inserting an `intros_run` row. If we're inserting one today, stop doing that. This is the upstream root cause — fixing it stops new bad rows from being created.

### 5. One-time data cleanup migration

Delete (or soft-flag) existing `intros_run` rows where `result_canon IN ('PLANNING_RESCHEDULE','PLANNING_2ND_INTRO','UNRESOLVED')` and the booking's `booking_status_canon` matches, since those rows shouldn't exist. We'll preview the count first via `read_query` before the migration runs.

## Verification

After changes, on the Pipeline page for Kyle Davis:

- "Intro Runs (1)" section disappears (he has no actual ran intros)
- 4/27 booking still shows in Bookings list with "Planning to Reschedule" status
- 4/29 booking with Koa is shown as a normal booking — no "2nd" badge
- He shows up in the right tab (Today / Upcoming) as a 1st intro

Same logic will fix every other client where a no-show-class or rescheduled booking was incorrectly inflating the run count or marking the rebook as a 2nd intro.

## Files touched

- `src/lib/canon/introRules.ts` (add `didIntroActuallyRun`)
- `src/features/pipeline/selectors.ts` (fix `isRealSecondIntro` + counts/filters)
- `src/features/pipeline/components/PipelineRowCard.tsx` (fix 2nd badge + filter Intro Runs list)
- `src/components/myday/OutcomeDrawer.tsx` and `src/lib/domain/outcomes/applyIntroOutcomeUpdate.ts` (stop creating run rows for non-ran outcomes — confirm in implementation)
- New migration: cleanup of existing PLANNING_RESCHEDULE runs

## Memory update

Add a Core rule: "An intro is 'ran' only if result_canon is not NO_SHOW / PLANNING_RESCHEDULE / PLANNING_2ND_INTRO / UNRESOLVED. Use `didIntroActuallyRun()` everywhere."