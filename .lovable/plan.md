## You're right — that's the bug pattern

Each surface (Coach View, My Day, My Intros, Shift cards, Pipeline, Follow-Up) has its **own** reimplementation of "is this a 2nd intro?". I patched the inline check on each surface separately, which is exactly the anti-pattern your rules forbid. The canonical helper `isSecondIntroBooking` exists, but every consumer still fetches its own parent rows and runs (or worse, uses a different check). Next time a rule shifts — friend bookings, VIP, no-show parents — we'll have to chase it through 6 files again.

## Fix — one hook, one data source, every surface

### 1. Single canonical hook: `useIntroClassification`

New file `src/hooks/useIntroClassification.ts`. Given a list of bookings in view, it:

- Collects all `originating_booking_id` values from those bookings.
- Fetches missing parents from `intros_booked` (`id, member_name, booking_status_canon, is_vip, ignore_from_metrics, deleted_at`).
- Fetches all parent runs from `intros_run` (`linked_intro_booked_id, result, result_canon`).
- Caches via React Query under a stable key (`['intro-classification', sortedIds]`).
- Returns:
  - `isSecondIntro(bookingId): boolean` — calls canonical `isSecondIntroBooking`
  - `getParent(bookingId): SecondIntroBookingLike | null`
  - `getParentRuns(bookingId): SecondIntroRunLike[]`
  - `loading: boolean`

All the helper does internally is call `isSecondIntroBooking` from `src/lib/intros/secondIntroDetection.ts` — that file stays the source of truth for the rule itself.

### 2. Rewire every consumer to use the hook

Replace each bespoke check with `const { isSecondIntro } = useIntroClassification(bookings); ... isSecondIntro(b.id)`. Delete the local fetch/state code in each:

| File | Lines to delete | Replacement |
|---|---|---|
| `src/pages/CoachView.tsx` | parentBookings/parentRuns state + parallel fetch + inline check | `useIntroClassification(bookings)` |
| `src/pages/CoachMyIntros.tsx` | `parentBookingsById` / `parentRunsByParentId` block + inline check | same |
| `src/features/myDay/useUpcomingIntrosData.ts` | the ~90-line bespoke "2nd intro detection" block (lines 268–390) | same — hook handles cross-batch parent lookups via a single parent-id query |
| `src/features/shiftView/ShiftIntroCards.tsx` | direct call to `isSecondIntroBooking` with raw `useData()` | same |
| `src/features/pipeline/selectors.ts` (`isRealSecondIntro`) | delete; pipeline already passes journey bookings/runs — wrap it to call the canonical helper directly | route through `isSecondIntroBooking` so there is exactly one rule |
| `src/features/followUp/useFollowUpData.ts` (`isRealSecondIntroBooking`) | delete local helper | route through canonical |
| `src/hooks/useIntroTypeDetection.ts` | mark deprecated, internally call canonical helper | (gradual — remove callers in same PR if cheap) |

### 3. Cross-batch / outside-batch parents

My Day's current code has special branches for "parent is outside the current batch". The hook handles this uniformly by always issuing the parent fetch for any `originating_booking_id` not already present in the input list. One code path, no branches.

### 4. Tests

- Reuse Maliyah's shape as a fixture in `src/lib/intros/__tests__/secondIntroDetection.test.ts` (new): parent ACTIVE + parent run NO_SHOW → child is NOT a 2nd intro.
- Friend booking (different `member_name`) → 1st intro.
- Parent SHOWED with no runs yet → still 2nd intro (existing behavior preserved).
- DELETED_SOFT parent → child is 1st intro.

### 5. Coherence proof I'll produce before closing

```
COHERENCE PROOF
- DB rows verified (Maliyah):
  - parent 3600e7e8 booking_status_canon=ACTIVE
  - run b0285894 result_canon=NO_SHOW linked to parent
  - child 77a7ee3a (6/20 10:30)
- All consumers route through useIntroClassification → isSecondIntroBooking:
  - Coach View 6/20: 1st Intro
  - My Day upcoming: 1st Intro
  - CoachMyIntros: visitType FIRST
  - ShiftIntroCards: 1st Intro
  - Pipeline row: 1st Intro
  - Follow-Up queue: classified as 1st-intro journey
- Canonical helpers extracted: useIntroClassification (new)
- Local duplicates deleted: 6 (listed above)
- All agree: yes
```

## Out of scope

- No DB changes, no canon enum changes.
- No commission, attribution, scorecard, or close-rate logic touched.
- No UI redesign — only the data source behind the existing "2nd Intro" badge.

Used the `system-change-audit` skill.