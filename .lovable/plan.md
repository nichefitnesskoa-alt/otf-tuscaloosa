The intro credit always goes to the first coach who coached the person not the coach for the second class.  James did coach both times though 

&nbsp;

## Root cause

Studio Scoreboard shows **7 sales / 78%**. WIG shows **6 closes / 67%**. The difference is one real sale: **Alexa Brodsky — Premier, James, May 4** (run id `2375d2ca…`).

Why the gap:

- **Studio** counts a sale if its `intros_run` row has `isMembershipSale` and `buy_date` in range. It does not care about the booking chain. → Alexa counted.
- **WIG** counts only **first-intro bookings** in the date range (`!originating_booking_id || referred_by_member_name`), then attributes Coached/Closes off those. Alexa's run is on a **2nd-intro booking** (`b647bc02…`). Its originating 1st intro (`467a6805…`) is `booking_status_canon = DELETED_SOFT`, so `isBookingExcludedFromMetrics` drops it from `firstIntroBookings`. The 2nd intro itself is filtered out because it has an `originating_booking_id`. → Alexa never enters WIG's coach map.

So when a 1st intro gets soft-deleted (e.g., it wasn't a true intro), but its 2nd intro actually ran and sold, WIG silently loses that close. Studio still counts the sale. The two views drift.

This is a real category of orphan: the 2nd intro is a legitimate intro that ran with a real coach and produced a real sale. James coached it. He should get the close.

## Fix

Promote orphaned 2nd intros to "standalone first intros" inside WIG's coach attribution loop, so they get a Coached row and a Close row attributed to whoever coached the 2nd intro.

### Files to edit

`**src/pages/Wig.tsx**` — `loadCoachData` / `firstIntroBookings` build (around lines 343–402):

1. After fetching `coachBookingsRes` and computing `allCoachBookings`, also fetch the **originating bookings** referenced by any 2nd-intro in `allCoachBookings` (one batched `.in('id', originatingIds)` query, no class_date filter).
2. Build `excludedOriginatingIds = Set` of those originating bookings where `isBookingExcludedFromMetrics(orig) === true` OR the originating booking does not exist (404 / orphan).
3. Change the `firstIntroBookings` filter from
  ```
   !b.originating_booking_id || !!b.referred_by_member_name
  ```
   to
   That way Alexa's 2nd-intro booking is treated as a first intro for Coached/Closes.
4. Leave the rest of the pipeline alone — `showedFirstIntroBookings`, `coachCloseMap`, Total-Journey 2nd-intro lookup, and the drilldown row construction all already work off `firstIntroBookings`.

### Why this is the right fix (not a symptom patch)

- It mirrors how a human reads the data: a 2nd intro whose 1st intro was thrown away is, operationally, the member's actual first real intro. Crediting the coach who ran it is correct.
- It keeps Studio's logic untouched (Studio is already correct at 7).
- It does **not** double-count: the original 1st intro is excluded from Coached, so the 2nd intro takes its slot exactly once.
- It does **not** affect chains where the 1st intro is healthy — those still resolve via the existing Total-Journey path.
- It composes cleanly with `isBookingExcludedFromMetrics`, the canonical exclusion helper.

### Downstream effects to verify after build

- WIG Coach — Coached & Closes table totals will move from 6 → 7 closes (James +1).
- WIG Close-rate tile recomputes from the table totals → ~70% (7 / 10) for May 2026, matching what Studio reports.
- `PerCoachTable` (Studio) already filters via `isBookingExcludedFromMetrics`; behavior unchanged there.
- Drilldown for James → Closes will gain one row labeled SALE for Alexa Brodsky, via `direct` (since the run is on her booking, not a chained child).

### Out of scope

- No DB changes, no migrations, no edits to `close-detection.ts`, `excludedBookings.ts`, or Studio metrics.
- Not changing how soft-deleted 1st intros are treated elsewhere (they remain excluded, as designed).
- Not touching the rebooking flow that creates these 2nd intros.

### Test

After the edit, re-run the existing test suite (`bunx vitest run`) — no test changes expected. Spot-check May 2026 in the preview: WIG should show 7 closes total and James should jump from 2 → 3.