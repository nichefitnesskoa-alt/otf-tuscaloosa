# Anna 6/30 showing as 1st intro — root cause + fix

## What's actually in the DB
Four bookings for Anna Pauley (614-633-6157):

1. **6/17** `4a0621c1` — coach Natalya, status `SECOND_INTRO_SCHEDULED`, no parent. The real ran 1st intro.
2. **6/23** `4b41faf2` — DELETED_SOFT. Parent = 6/17.
3. **6/25** `88f67bcd` — DELETED_SOFT. Parent = 6/17.
4. **6/30** `5fe29115` — ACTIVE (today). Parent = **6/25** (the deleted one).

So 6/30's chain is: `6/30 → 6/25 (deleted) → 6/17 (ran)`. It's a 2nd intro — the rescheduled child of a rescheduled child of the real 6/17 intro.

## Why the app shows it as 1st
`src/lib/intros/secondIntroDetection.ts` bails the moment the immediate parent is excluded:

- Line 66: `if (isBookingExcludedFromMetrics(parent)) return false;` — soft-deleted parents are excluded → returns false.
- Line 69: same for `NON_RAN_BOOKING_STATUSES` (DELETED_SOFT, CANCELLED, PLANNING_RESCHEDULE).

A reschedule chain that goes through a soft-deleted intermediate booking gets treated as a brand-new 1st intro. That's the bug — every time staff delete an intermediate reschedule row, the next booking loses its 2nd-intro status.

## Fix

### 1. `src/lib/intros/secondIntroDetection.ts`
When the immediate parent is "non-qualifying because it never ran" (deleted / cancelled / planning_reschedule / no run yet, i.e. a pure reschedule passthrough), **recurse up to the grandparent** instead of returning false. Stop and return true only when we find an ancestor that actually ran (`didIntroActuallyRun`). Stop and return false only when we hit a true root (no `originating_booking_id`) or a different-member chain.

Guard with a visited-set to avoid cycles. Keep the "friend booking" (`referred_by_member_name`) short-circuit.

`getEffectiveRootBookingId` already loops via `isSecondIntroBooking`, so once the helper is recursive the root walk fixes itself.

### 2. `src/lib/intros/loadIntroClassification.ts`
Today it fetches only the immediate parents listed in `bookingsInView`. With recursive ancestry, we need the full chain. Change the parent fetch to a loop:

```
seed missing parent ids → fetch → collect any of their originating_booking_id that aren't loaded yet → fetch again → repeat until no new ids (cap at e.g. 6 hops).
```

Then fetch `intros_run` for **all** ancestor ids, not just direct parents, so `isSecondIntroBooking` can check whether any ancestor's run actually happened.

### 3. Coherence check after fix
Re-verify with `read_query` and against the live UI:

- 6/30 booking `5fe29115` → `isSecondIntro = true`.
- MyDay card for Anna at 4:15 PM today shows the "2nd Intro" badge instead of "1st Intro".
- Pipeline person sheet still shows Chain 1 / Chain 2 as today (chain numbering is by root, unaffected).
- Coach View, Per-SA close rate, Conversion Funnel: confirm Anna 6/30 is NOT counted as a new 1st intro denominator (otherwise it would inflate Nathan's denominator and Grace F's denominator a second time for the same person).
- Anna 6/17 stays the canonical 1st intro for Natalya / Jayna's attribution.

## Files touched
- `src/lib/intros/secondIntroDetection.ts` — recursive parent walk.
- `src/lib/intros/loadIntroClassification.ts` — transitive ancestor + run fetch.

## Files NOT touched
No component changes needed. Every surface (MyDay, Coach View, Pipeline, Follow-Up, Shift View, Per-SA, Conversion Funnel) already routes through `loadIntroClassification` / `isSecondIntroBooking` per the canonical-helpers rule, so this single fix corrects every page at once.

## Out of scope
Not touching the underlying data — the soft-deleted reschedule rows are correct as-is and are how the studio tracks reschedule history. The classifier is what needs to understand them.
