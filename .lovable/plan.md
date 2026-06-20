## The bug

Maliyah Grant's 6/19 8:45 AM intro was logged as **No-show** on the run, but her booking row's `booking_status_canon` is still **ACTIVE** (the run captures the no-show, the booking status was never flipped). Her 6/20 10:30 booking points back at the 6/19 booking via `originating_booking_id`, so Coach View renders it with a "2nd Intro" badge.

We do have the canonical helper `isSecondIntroBooking` in `src/lib/intros/secondIntroDetection.ts` that handles exactly this case — it walks into `intros_run` and rejects the parent if no run actually `didIntroActuallyRun()`. But several surfaces never adopted it and still do the inline check `!!originating_booking_id && parent.booking_status_canon not in NON_RAN`. That inline check misses no-show parents whose booking_status_canon stayed ACTIVE/SHOWED.

Verified in DB:

```
3600e7e8 (6/19 08:45)  booking_status_canon=ACTIVE   originating=null
9b6fb987 (6/19 10:30)  DELETED_SOFT                  originating=3600e7e8
77a7ee3a (6/20 10:30)  ACTIVE                        originating=3600e7e8  ← shown as "2nd Intro"
```

The 3600e7e8 run is a no-show, so 77a7ee3a should be a **1st Intro**.

## Fix — route every 1st/2nd badge through the canonical helper

All four surfaces below currently use inline `originating_booking_id` checks (with or without origStatus). Replace them with `isSecondIntroBooking(child, allBookings, allRuns)`. Fetch the parents' runs alongside the parents themselves.

1. **`src/pages/CoachView.tsx`** (line 410)
   - In `fetchBookings`, when loading `origIds` parents, ALSO load `intros_run` rows where `linked_intro_booked_id IN (origIds)` (fields: `linked_intro_booked_id`, `result`, `result_canon`).
   - Store parents (full `SecondIntroBookingLike` shape, including `member_name`, `booking_status_canon`, `is_vip`, `ignore_from_metrics`, `deleted_at`) and parent runs in state (replace `originatingStatuses`).
   - Compute `isSecondIntro` via `isSecondIntroBooking(intro, [intro, ...parentBookings], parentRuns)`.

2. **`src/pages/CoachMyIntros.tsx`** (line 414)
   - Same swap. The page already loads runs (`runByBooking`); extend the parent-status fetch to also pull parent runs and feed `isSecondIntroBooking`.

3. **`src/features/shiftView/ShiftIntroCards.tsx`** (line 38)
   - Replace `const isSecond = !!intro.originating_booking_id` with `isSecondIntroBooking(intro, introsBooked, introsRun)` using `useData()` (extend `useData` consumer to read `introsRun` if not already exposed).

4. **`src/features/pipeline/components/PipelineRowCard.tsx`** (line 191)
   - Same swap; pipeline data context already has runs.

No DB / canon / commission / attribution changes. The canonical helper already exists — we are just adopting it everywhere a stale inline check survived.

## Coherence proof I'll produce before closing

```
COHERENCE PROOF
- DB row: intros_booked 77a7ee3a (Maliyah 6/20 10:30)
  parent 3600e7e8 (6/19 08:45) booking_status_canon=ACTIVE, run.result_canon=NO_SHOW
- Coach View 6/20 10:30: badge = "1st Intro"          ← was "2nd Intro"
- Coach View 6/19 10:30 (deleted): hidden              ← already excluded
- Coach View 6/19 08:45: 1st Intro, No-show run        ← unchanged
- CoachMyIntros: visitType = FIRST for 6/20 booking
- ShiftIntroCards: "1st Intro" badge
- Pipeline row: "1st Intro" badge
- All agree: yes
```

## Out of scope

No changes to commission, sales detection, follow-up routing, week grouping, staff lists, scorecard replication, or canon enums. No DB migration.

Used the `system-change-audit` skill.