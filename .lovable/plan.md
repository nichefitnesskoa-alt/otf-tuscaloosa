# Fix Kyle Davis showing as 2nd intro on My Day

## Root cause

Kyle has two bookings:

- 4/27 6:15 with James → `booking_status_canon = PLANNING_RESCHEDULE` (the intro never ran)
- 4/29 6:15 with Koa → `originating_booking_id` points to the 4/27 booking

The Pipeline already uses the canonical `isRealSecondIntro` selector that disqualifies originators in `NON_RAN_BOOKING_STATUSES` (`PLANNING_RESCHEDULE`, `CANCELLED`, `DELETED_SOFT`, `NO_SHOW`). My Day does NOT use that selector. It has its own 2nd-intro detector inside `src/features/myDay/useUpcomingIntrosData.ts` that pre-dates the canon helper and only filters out `NO_SHOW` originators.

So Kyle's 4/29 booking falls through and gets `isSecondIntro = true` on the My Day card, even though the canon rule (and the Pipeline) correctly say it's a 1st intro.

There are three blocks in `useUpcomingIntrosData.ts` and one prop in `MyDayPage.tsx` with the same bug.

## Files to change

### 1. `src/features/myDay/useUpcomingIntrosData.ts`

Import the canonical disqualifier set:

```ts
import { NON_RAN_BOOKING_STATUSES } from '@/lib/canon/introRules';
```

Then replace the three `booking_status_canon !== 'NO_SHOW'` checks with `!NON_RAN_BOOKING_STATUSES.has(...)`:

- Block 1 (line ~270): in-batch originator check — currently `if ((orig as any).booking_status_canon !== 'NO_SHOW')`. Change to disqualify any originator whose status is in the non-ran set.
- Block 3 (line ~360): out-of-batch originator query — same fix on the `origBooking.booking_status_canon` check.
- Block 2 (lines ~292 and ~333): the `intros_run` "prior runs" queries currently only filter `.neq('result_canon', 'NO_SHOW')`. Replace with `.not('result_canon', 'in', '(NO_SHOW,PLANNING_RESCHEDULE,UNRESOLVED,VIP_CLASS_INTRO)')` so reschedule/unresolved run rows don't falsely flag a member as having a prior intro.

### 2. `src/features/myDay/MyDayPage.tsx` (line 503)

The Prep dialog uses a naive check:

```tsx
isSecondIntro={!!prepBooking.originating_booking_id && !(prepBooking as any).referred_by_member_name}
```

This needs to also confirm the originator actually ran. Since the dialog already has the booking in scope, look up the originator from the same React Query cache used by the page (or use the `isSecondIntro` already computed on the upcoming-intros item rather than recomputing). The simplest fix: pass through `item.isSecondIntro` from the row that opened the dialog instead of recomputing from raw fields.

## Verification

After the fix, on My Day for today (4/29):

- Kyle Davis 6:15 with Koa shows the "1st Intro" badge (not "2nd Intro")
- His Q badge logic, prep banner, and outcome drawer all behave as 1st-intro
- Other clients whose originator was a real ran intro still correctly show "2nd Intro"
- Pipeline behavior is unchanged (already correct)

## Files touched

- `src/features/myDay/useUpcomingIntrosData.ts` (3 logic blocks)
- `src/features/myDay/MyDayPage.tsx` (Prep dialog prop)

No DB changes needed — Kyle's data is correct, only the My Day detector reads it wrong.
