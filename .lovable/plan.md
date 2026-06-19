## The bug (verified in DB)

Maliyah Grant's Jun 19 intro was a **no-show RUN** (booking_status_canon is still `ACTIVE`, but the linked `intros_run.result_canon = 'NO_SHOW'`). Her Jun 20 booking has `originating_booking_id` pointing at the Jun 19 row, so every consumer that decides "1st vs 2nd intro" from `originating_booking_id` alone labels Jun 20 as "Chain 1 · 2nd". It should be a 1st intro — she never actually had a 1st.

There's also a 3rd row (DELETED_SOFT, 10:30 Jun 19) — confirms the chain link, not the bug.

Existing helpers cover *part* of this:
- `NON_RAN_BOOKING_STATUSES` (NO_SHOW / CANCELLED / PLANNING_RESCHEDULE / DELETED_SOFT) — only checks booking status.
- `didIntroActuallyRun(run)` — only checks a single run.
- `useIntroTypeDetection` excludes NO_SHOW *bookings* from grouping, but NOT bookings whose status is ACTIVE with a no-show run, and NOT CANCELLED.
- `ConversionFunnel`, `PersonJourneyCard`, `useUpcomingIntrosData`, `useFollowUpData`, `Wig.tsx` chain-walk all check `originating_booking_id` directly with no parent-actually-ran gate.

This is the system-coherence bug the workspace rules call out — one concept ("is this a 2nd intro?") implemented inline in 6+ places.

## The fix — one canonical helper, route every consumer through it

### 1. New canonical helper: `src/lib/intros/secondIntroDetection.ts`

```ts
isSecondIntroBooking(child, allBookings, allRuns): boolean
```

Returns `true` only when ALL of:
1. `child.originating_booking_id` is set
2. `child.referred_by_member_name` is null (friend bookings are 1st intros)
3. The parent booking exists in `allBookings`
4. Parent's `member_name` matches child's (same person; otherwise friend)
5. Parent is **not excluded** (`isBookingExcludedFromMetrics`)
6. Parent's `booking_status_canon` is **not** in `NON_RAN_BOOKING_STATUSES`
7. Parent has at least one run where `didIntroActuallyRun(run)` is true
   *(this is the new gate — handles the Maliyah case where booking is ACTIVE but the run was NO_SHOW)*

Plus a companion `getEffectiveOriginatingBookingId(child, allBookings, allRuns)` that walks up the chain skipping no-show / cancelled / rescheduled parents, so chain index ("Chain N") and root resolution stay correct.

### 2. Replace inline checks (the reach map)

| File | Current inline logic | Replace with |
|---|---|---|
| `src/components/person/PersonJourneyCard.tsx` (lines 168-189) | child = any booking with `originating_booking_id` | `isSecondIntroBooking()` — fixes the visible "Chain 1 · 2nd" bug |
| `src/components/dashboard/ConversionFunnel.tsx` (`bookingIsSecond` map) | same | `isSecondIntroBooking()` |
| `src/hooks/useIntroTypeDetection.ts` | excludes only NO_SHOW bookings; checks `originating_booking_id` w/ same-name | route through `isSecondIntroBooking()`; preserve fallback to "2ND" status text |
| `src/features/myDay/useUpcomingIntrosData.ts` (2nd-intro detection block) | originating_booking_id + same name | `isSecondIntroBooking()` |
| `src/features/followUp/useFollowUpData.ts` (`secondIntroByOrigin`) | originating_booking_id present | `isSecondIntroBooking()` |
| `src/features/myDay/useWinTheDayItems.ts` line 191 (`skip 2nd intros`) | `if (intro.originating_booking_id) continue` | `if (isSecondIntroBooking(...)) continue` |
| `src/pages/Wig.tsx` chain-walk (lines 619-625) and 2nd-intro grouping (lines 499-504, 671) | originating_booking_id present | `isSecondIntroBooking()` + `getEffectiveOriginatingBookingId()` |
| `src/lib/intros/orphanedFirstIntros.ts` | already handles excluded parents | extend: parent counts as "excluded for orphan-promotion purposes" if it also failed `didIntroActuallyRun` (so the Maliyah child gets promoted to 1st intro in funnels/metrics, not just in the journey card) |

### 3. Verify with the same DB row

After the fix, Maliyah's three rows produce:
- Jun 19 (ACTIVE, no-show run) → 1st intro
- Jun 19 10:30 (DELETED_SOFT, excluded) → not displayed
- Jun 20 (ACTIVE, originating → Jun 19 which didn't actually run) → **1st intro** (was: 2nd)

Cross-page checks to confirm coherence:
- Person Journey Card: both visible rows labeled "Chain 1 · 1st" / "Chain 2 · 1st"
- Conversion Funnel: Maliyah counts in 1st Intro Booked row twice, not in 2nd Intro row
- WIG Per-Coach: Koa keeps the 1st (no-show), James gets a 1st (was being counted as Koa's 2nd)
- MyDay Upcoming Intros: Jun 20 card no longer flagged "2nd intro"
- Follow-Up Queue: Jun 20 doesn't appear in "2nd Intro" tab

## Out of scope

- No DB schema changes. We do NOT clear `originating_booking_id` — the link is still useful for chain traversal and audit. We just stop misinterpreting it.
- No changes to commission attribution math, sales-detection, or `isCloseRun`. The journey/sale logic in `journey.ts` already calls `isBookingExcludedFromMetrics`; the new helper is additive.
- No changes to staff dropdowns, dates, roles, or VIP logic.

## Files touched

- `src/lib/intros/secondIntroDetection.ts` (new)
- `src/components/person/PersonJourneyCard.tsx`
- `src/components/dashboard/ConversionFunnel.tsx`
- `src/hooks/useIntroTypeDetection.ts`
- `src/features/myDay/useUpcomingIntrosData.ts`
- `src/features/myDay/useWinTheDayItems.ts`
- `src/features/followUp/useFollowUpData.ts`
- `src/pages/Wig.tsx`
- `src/lib/intros/orphanedFirstIntros.ts`

## Closing

I'll end the build with a COHERENCE PROOF block: `read_query` confirming the three Maliyah rows, plus the labeled counts produced by each consumer above (Journey card, Funnel, WIG, MyDay, Follow-Up) all agreeing.
