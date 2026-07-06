Two fixes on MyDay.

## 1. "Missing a coach" banner assigns the coach (doesn't open outcome)

Today the banner calls `setOutcomeBookingId(tbdCoachBookings[0].id)` which pops the **Log Outcome** drawer — wrong tool for the job.

Replace with a lightweight **Assign Coach** dialog:
- New component `AssignCoachDialog` at `src/features/myDay/AssignCoachDialog.tsx`
- Lists every booking in `tbdCoachBookings` as a compact row: `member · date · time` + a coach `<Select>` populated from the canonical coaches list (`mem://logic/canon-lists/coaches` — via `useActiveStaff({ role: 'coach' })` or the existing coach-picker used in `EditBookingDialog`)
- On change, update `intros_booked.coach_name` immediately (with `last_edited_by = userName`, `edit_reason = 'Assigned coach from missing-coach banner'`, `last_edited_at = now()`), toast "Saved", strip the row from the list
- When the list empties, auto-close and `refreshData()`
- Wire the banner button to open this dialog instead of the outcome drawer

Handles the case of multiple TBD bookings in one pass (Koa currently would have to click banner N times).

## 2. "Missing an outcome" banner — 2 hours after class start

New MyDay banner mirroring the "missing a coach" pattern, styled amber/red so it reads as urgent but distinct.

**Detection (in MyDayPage, alongside `tbdCoachBookings`):**
```
missingOutcomeBookings = intros where:
  - class_date + intro_time is ≥ 2h in the past (America/Chicago)
  - not deleted, canon not in (CANCELLED, DELETED_SOFT, PLANNING_RESCHEDULE)
  - has NO linked intros_run row (hasLinkedRun === false)
  - class_date within last 7 days (same window as coach banner)
```
Uses the existing `class_start_at` column (already selected in `useUpcomingIntrosData`), no timezone reimplementation — anchored to America/Chicago via existing helpers.

**Banner behavior:**
- Copy: `"N intro{s} missing an outcome — tap to log"` (or singular member name if N=1: `"Log outcome for {name} — class was Xh ago"`)
- Tap opens the **existing** `OutcomeDrawer` for the first booking (this IS the outcome flow, unlike the coach banner). After save, if more remain, drawer stays open with the next one.
- Position directly below the coach banner so both are visible when both apply.

**Per-card signal (already partially there):**
`IntroRowCard.isOutcomeOverdue` currently trips at `-60` minutes. Raise the threshold to `-120` so the card-level red banner matches the new page-level banner and Koa doesn't see conflicting timing signals.

## Coherence

- Both banners use the same source of truth (`intros_booked` + `intros_run` from MyDay's `useIntroData`) — no new query hook, no divergent counts.
- After assigning a coach in the new dialog, the same `refreshData()` used by EditBookingDialog runs, so Coach View / WIG / Studio pick up the change on next fetch (they already read `coach_name` off `intros_booked`).
- After logging an outcome via the banner, the existing OutcomeDrawer `onSaved` already invalidates the right query keys.
- The 2h-past-start check reuses `class_start_at` already loaded in the hook — no extra fetch, no new realtime channel needed.

## Files touched

- `src/features/myDay/MyDayPage.tsx` — swap banner handler, add missing-outcome banner + memo
- `src/features/myDay/AssignCoachDialog.tsx` — new
- `src/features/myDay/IntroRowCard.tsx` — raise `isOutcomeOverdue` threshold from -60 to -120

## Verification before done

- Trigger UI with a real TBD booking (find one via `SELECT id, member_name FROM intros_booked WHERE coach_name IS NULL OR coach_name='TBD' AND class_date >= current_date - 7 LIMIT 1`), tap banner → confirm the coach dropdown appears (not outcome), pick coach, confirm DB row updates.
- Query DB for intros ≥2h past start with no run row today → confirm banner count matches; tap → OutcomeDrawer opens for that booking; save → banner count decrements.