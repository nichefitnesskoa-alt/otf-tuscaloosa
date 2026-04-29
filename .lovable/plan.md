# Fix coach-side 2nd-intro detection (Kyle Davis bug, app-wide)

## Root cause

When we fixed My Day and Pipeline, we did not update the coach surfaces. Three coach files still use legacy logic that flags any booking with an `originating_booking_id` as a 2nd intro (or only disqualifies `NO_SHOW`). They never check the canonical `NON_RAN_BOOKING_STATUSES` set, so Kyle's 4/29 booking — whose originator is `PLANNING_RESCHEDULE` — incorrectly renders as 2nd Intro on the coach side.

## Files to change

### 1. `src/pages/CoachView.tsx` (Coach View weekly grid)

Line 391–392 currently:
```ts
const isSecondIntro = !!intro.originating_booking_id &&
  originatingStatuses[intro.originating_booking_id] !== 'NO_SHOW';
```

Replace with the canonical set:
```ts
import { NON_RAN_BOOKING_STATUSES } from '@/lib/canon/introRules';
...
const origStatus = intro.originating_booking_id
  ? originatingStatuses[intro.originating_booking_id]
  : null;
const isSecondIntro = !!intro.originating_booking_id
  && !!origStatus
  && !NON_RAN_BOOKING_STATUSES.has(origStatus);
```

This is what gates the "2nd Intro" stub render on line 395–411 and the "no prep needed" badge — so fixing this single line correctly demotes Kyle to a full 1st-intro card with prep, debrief, and lead measures.

### 2. `src/components/coach/CoachIntroCard.tsx` (the actual coach card)

Line 89 currently:
```ts
const isSecondIntro = !!booking.originating_booking_id;
```

This is the worst offender — it doesn't even check the originator status. Add `originating_booking_status` to the `CoachBooking` type (and to the SELECT in `CoachView.tsx` / `CoachMyIntros.tsx` queries), then:

```ts
import { NON_RAN_BOOKING_STATUSES } from '@/lib/canon/introRules';
...
const isSecondIntro = !!booking.originating_booking_id
  && !!booking.originating_booking_status
  && !NON_RAN_BOOKING_STATUSES.has(booking.originating_booking_status);
```

The simplest plumbing: have `CoachView.tsx` (which already fetches `originatingStatuses`) pass `originatingBookingStatus` as a prop into `CoachIntroCard`. That avoids a per-card extra query and reuses the lookup we already do.

`isSecondIntro` controls:
- whether we fetch `intros_run` data (line 101)
- whether we render the prep/debrief/lead-measures sections (line 230, 398)

So this fix flows through all of those automatically.

### 3. `src/pages/CoachMyIntros.tsx` (Coach My Intros page)

Line 338 currently:
```ts
const isSecondIntro = !!b.originating_booking_id;
```

Add `originating_booking_status` lookup the same way (we already fetch `chainBookingIds` data, just include `booking_status_canon` in that select on line 283), then:

```ts
const origStatus = b.originating_booking_id
  ? origStatusById.get(b.originating_booking_id)
  : null;
const isSecondIntro = !!b.originating_booking_id
  && !!origStatus
  && !NON_RAN_BOOKING_STATUSES.has(origStatus);
```

This affects the `second_intro` filter tab (line 401) and the badge rendering for each row.

## Why this is the full fix (not a patch)

After the My Day fix, Pipeline and My Day used the canonical rule, but Coach View, CoachIntroCard, and Coach My Intros each had their own copy-pasted detection. Kyle showed correctly on SA surfaces and incorrectly on coach surfaces. This change makes all five surfaces import from the same canonical helper (`NON_RAN_BOOKING_STATUSES` in `src/lib/canon/introRules.ts`) so future changes to the rule apply everywhere automatically.

## Downstream effects (all implemented in this build)

- Coach View weekly grid: Kyle renders as full 1st-intro card with prep banner, debrief section, and lead measures — not the collapsed "No prep needed" stub.
- CoachIntroCard: fetches `intros_run` row, shows the goal/why prompt, made-a-friend toggle, and relationship experience field.
- Coach My Intros page: Kyle no longer appears under "2nd Intro" filter tab; appears under "1st Intro" tab with correct badge.
- Pipeline, My Day, Follow-up tabs: unchanged (already correct).
- No DB changes required — Kyle's data is correct, only three more code surfaces needed the canonical rule.

## Verification

After the build, on Coach View / CoachMyIntros / CoachIntroCard for 4/29:
- Kyle Davis 6:15 with Koa shows "1st Intro" badge everywhere.
- Coach prep, debrief, and lead-measure sections all render for him.
- Other clients whose originator was a real ran intro (`SHOWED`, `SOLD`, etc.) still correctly show "2nd Intro".
- Pipeline + My Day behavior unchanged.

## Files touched

- `src/pages/CoachView.tsx` (detection + add `booking_status_canon` to originating-status fetch — already there)
- `src/components/coach/CoachIntroCard.tsx` (detection + accept new prop)
- `src/pages/CoachMyIntros.tsx` (detection + add `booking_status_canon` to chain query)
