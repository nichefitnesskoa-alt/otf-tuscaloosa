## Problem

Carsyn Gleichowski no-showed her Feb 4 booking, then was rebooked via the Reschedule flow for Apr 28. The new booking has `originating_booking_id` pointing to the no-show. Because something has an originating link, several parts of the app flag the new booking as a **2nd Intro**, send "No Q Needed", auto-prep it, and skip questionnaire prompts.

This violates the canon rule already documented in the project: **a no-show is not a prior visit — the person never had their intro.** The rebooking IS their 1st intro.

The MyDay 2nd-intro detector already has this check for bookings inside the current batch, but:

1. **MyDay's "outside-batch" lookup** (`useUpcomingIntrosData.ts` step 3) only fetches `member_name` for the originating booking — it never checks status, so a no-show originator still flips the new booking to 2nd intro. **This is what's hitting Carsyn.**
2. **`MyDayIntroCard.tsx`** uses naive `!!booking.originating_booking_id` with no status check at all.
3. **Pipeline `selectors.ts`** (`has2ndIntro`, journey detection) treats any `originating_booking_id` as a 2nd intro without checking whether the originator was a no-show.
4. **FollowUp `useFollowUpData.ts`** maps `secondIntroByOrigin` and dismisses parent follow-ups whenever an `originating_booking_id` exists — same blind check.
5. **`useIntroTypeDetection.ts`** has the no-show guard for in-memory bookings but no fallback when the originator isn't loaded.

## Fix — single rule, applied everywhere

> A booking is a **2nd Intro** only if the originating (or any prior) booking for the same member was **NOT** `booking_status_canon = 'NO_SHOW'` AND was not soft-deleted. No-show originators are ignored; the current booking is treated as the **1st Intro**.

### Files to change

**1. `src/features/myDay/useUpcomingIntrosData.ts`** (step 3, ~line 351)
- Update the outside-batch query to also select `booking_status_canon, deleted_at`.
- Only flip `isSecondIntro = true` when the originating booking is same-member AND not `NO_SHOW` AND not soft-deleted.

**2. `src/components/myday/MyDayIntroCard.tsx`** (line 85)
- Stop computing `isSecondIntro` from `originating_booking_id` alone. Accept `isSecondIntro` as a prop from the parent (which already does the proper detection), or look up the originating booking's status. Prefer prop-passing — parent (`useUpcomingIntrosData`) already resolves it correctly.

**3. `src/features/pipeline/selectors.ts`** (lines 185, 191, 263, 272)
- For each `originating_booking_id` check, also look up the originator in `journey.bookings` and require `booking_status_canon !== 'NO_SHOW'` and `!deleted_at` before counting it as a 2nd intro / setting `has2ndIntro`.

**4. `src/features/followUp/useFollowUpData.ts`** (lines 182, 210–211, 362)
- When building `secondIntroByOrigin` and when resolving `orig` in the dismissal logic, treat a no-show originator the same as "no originator" — do not dismiss the originator's follow-up, and do not surface the new booking as a 2nd intro on the parent.
- For the parent-dismissal block (line ~210), only dismiss when the originator is `SHOWED` or otherwise non-no-show.

**5. `src/hooks/useIntroTypeDetection.ts`** (already handles in-memory case; no change needed for that branch). Add a small note in the comment that callers must pass the originating booking row when available; outside-batch resolution is the caller's responsibility.

### Why `MyDayIntroCard` matters separately
That card is rendered in a couple of places that don't run through `useUpcomingIntrosData` (e.g., direct booking views). Either pass `isSecondIntro` in or fetch the originator's status. Passing it as a prop is simpler and matches `IntroRowCard`'s pattern.

### What NOT to change
- The DB / `originating_booking_id` linkage from the Reschedule flow is correct — it's how we trace the journey for follow-ups and analytics. We only change how it's *interpreted* for the 1st-vs-2nd label.
- VIP and friend (`referred_by_member_name`) carve-outs already in place stay as-is.

### Verification (after build mode)
- Confirm Carsyn's Apr 28 booking shows **1st Intro** badge on MyDay, gets a "Send Q" prompt, and is not auto-prepped.
- Confirm a true 2nd intro (originator with `SHOWED` or any non-no-show status) still shows the **2nd** badge and skips the Q.
- Confirm Pipeline journey for Carsyn shows one chain but the active row is labeled 1st Intro.
- Confirm her old no-show follow-up isn't dismissed by the rebook (since the new booking shouldn't be treated as a 2nd intro).
