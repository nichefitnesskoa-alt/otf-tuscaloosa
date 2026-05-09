## Problem

In `ConversionFunnel.tsx`, the **1st Intro** row and **2nd Intro** row are computed independently. A person who books a 1st intro and then a 2nd intro (within the date range) currently shows up in **both** rows. That double-counts the same person across the funnel and inflates 1st‑intro denominators.

You said: if 2nd intros stay in the funnel, then once someone has had their 2nd intro, they should no longer appear in the 1st intro row.

## Fix

Update `computeFunnelBothRows` so that a person is attributed to **exactly one** row — their furthest-progressed step in the chain.

### Rule

For each person (resolved by `personKey` — phone first, name fallback):

- If they have a **2nd intro booking** (or a 2nd ran intro via `PLANNING_2ND` chain) within the range → count them only in the **2nd Intro** row.
- Otherwise → count them in the **1st Intro** row as today.

"Has a 2nd intro" = `personHasSecondBooking.get(key) === true` **and** the qualifying 2nd booking has already passed (`hasBookingPassed`) OR a non-excluded run with `result_canon = PLANNING_2ND` has already occurred for that person. Pending future 2nd bookings do not yet remove them from 1st.

### Implementation steps

1. Build `personHasPassedSecond: Set<personKey>` after the existing booking loop, by iterating `activeBookings` and flagging persons whose 2nd booking passed.
2. In the `firstBookings` filter, additionally exclude any booking whose `personKey` is in `personHasPassedSecond`. Their 1st intro is now represented by the 2nd Intro row.
3. Leave the **Total Journey** row alone — it already de-dupes by anchoring to 1st showed + total sold, and we want it to keep representing the journey.
4. Recheck pull-forward math: `effectiveFirstBooked = max(firstBookings.length, effectiveFirstShowed)` — `firstShowed` and `firstSold` only iterate `firstBookings`, so dropping a booking will also drop its showed/sold from the 1st row (correctly attributed to 2nd row instead).

### Test coverage

Add one case to `src/components/dashboard/__tests__/conversionFunnel.test.ts`:

- Person A: 1st booked + ran on day 1, 2nd booked + ran on day 5, no sale. Range covers both days.
- Expect: 1st row → 0 booked / 0 showed / 0 sold for this person; 2nd row → 1 / 1 / 0; Total Journey → still 1 / 1 / 0.

### Files

- `src/components/dashboard/ConversionFunnel.tsx`
- `src/components/dashboard/__tests__/conversionFunnel.test.ts`

### Out of scope

No DB changes. No changes to Studio Scoreboard, Per-SA, or Total Journey logic.
