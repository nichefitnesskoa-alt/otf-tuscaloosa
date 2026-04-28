# April WIG Window: Bookings With Coach = TBD

These 12 standard intros for **April 1 – April 30, 2026** have `coach_name = 'TBD'` and are currently flowing into WIG without an attributed coach. Full file: `tbd_april_wig.csv`.

| Member | Day | Time | Status | Outcome |
|---|---|---|---|---|
| Bradli Davis | Wed 4/01 | 6:15 AM | Planning Reschedule | — |
| jasmine beamon | Wed 4/01 | 5:30 PM | 2nd Intro Scheduled | Booked 2nd intro |
| Calleigh George | Fri 4/03 | 8:45 AM | Planning Reschedule | — |
| Amanda Nichols | Mon 4/13 | 10:00 AM | Active | Pending |
| Steel Rawls | Tue 4/14 | 11:15 AM | Planning Reschedule | — |
| Trinity Adams | Thu 4/16 | 8:45 AM | 2nd Intro Scheduled | Booked 2nd intro |
| ellie swearingen | Thu 4/16 | 11:15 AM | Active | On 5 Class Pack |
| Aubrey Thomas | Wed 4/22 | 8:45 AM | Active | Pending |
| Ella Minton | Thu 4/23 | 5:30 PM | 2nd Intro Scheduled | Booked 2nd intro |
| Noah Mesa | Sat 4/25 | 10:30 AM | Active | Follow-up needed |
| Rory Duggan | Sat 4/25 | 10:30 AM | Active | No-show |
| Shea Jackson | Sun 4/26 | 10:00 AM | Active | Follow-up needed |

All 12 are `Online Intro Offer (self-booked)` — confirms the self-booked pipeline never assigns a coach at booking time.

---

# Build: Require Coach When Logging Outcome (If Missing)

## Rule
When an SA opens the outcome flow on a booking whose `coach_name` is empty or "TBD", the coach dropdown becomes a **required field for every outcome** (sale, no-show, follow-up, planning, reschedule — all of them). Save is blocked with a toast until a real coach is picked. Once saved, the booking's `coach_name` is updated to the chosen coach so it stops appearing as TBD everywhere downstream (WIG, Pipeline, Coach attribution).

If the booking already has a real coach assigned, behavior is unchanged.

## Files Touched

**`src/components/myday/OutcomeDrawer.tsx`**
- Add `bookingHasNoCoach = !initialCoach || initialCoach.trim() === '' || /^tbd$/i.test(initialCoach.trim())`.
- Update `coachRequired` to: existing rule **OR** `bookingHasNoCoach && !!outcome`.
- Show coach dropdown whenever `coachRequired` is true (it already renders for sale outcomes — extend the visibility condition).
- Add a small amber helper line above the coach dropdown when `bookingHasNoCoach`: "No coach on file — pick who taught this class."
- On save, when `bookingHasNoCoach && coachName`, also `update intros_booked set coach_name = coachName, last_edited_at, last_edited_by` so the booking record is corrected.

**`src/components/dashboard/OutcomeEditor.tsx`**
- This editor currently has no coach picker. Add one (using `COACHES` from `@/types`) shown only when the underlying booking has no coach / is TBD.
- Accept `currentCoach` prop from caller; require selection before save when missing; persist back to `intros_booked.coach_name` and pass `coachName` through to `applyIntroOutcomeUpdate`.
- Update the one call site to pass `currentCoach`.

**`src/components/dashboard/InlineIntroLogger.tsx`**
- Today it blindly writes the prop `coachName` into `intros_run`. If the prop is empty/"TBD", show the coach dropdown and require selection before submit; on submit, also patch `intros_booked.coach_name`.

**No DB migration needed** — uses existing `coach_name` column and existing `applyIntroOutcomeUpdate` plumbing.

## Downstream Effects (all handled in this build)
- WIG per-coach table stops counting "TBD" rows for new outcomes — coach gets proper credit.
- Pipeline coach column updates immediately because we patch `intros_booked.coach_name` on save.
- Coach View / Follow-Up ownership unaffected (already keyed off coach_name).
- Existing 12 TBD records above are **not** auto-fixed — they only get repaired when an SA next logs/edits an outcome on them. (If you want a one-time backfill UI, say the word and I'll add it.)

## Out of Scope
- Backfilling the 12 existing April TBD records.
- Fixing self-booked ingestion to auto-assign a coach at booking time (separate problem).
- Touching role permissions, navigation, or unrelated pages.
