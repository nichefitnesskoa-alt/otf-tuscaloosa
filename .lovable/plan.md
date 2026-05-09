## What I found

Alexa’s cleanup did run, but the Conversion Funnel still has a logic bug:

- Alexa’s original May 1 booking is soft-deleted.
- Alexa’s duplicate May 1 booking is soft-deleted.
- Alexa’s duplicate May 1 run is soft-deleted.
- Alexa’s May 4 sale booking is active.
- The remaining May 1 run is linked to the soft-deleted original booking.

The funnel currently drops runs linked to deleted bookings, then only counts runs linked directly to active bookings. That means it can miss the real May 1 ran intro, then pull the May 4 sale forward as the denominator. In short: the data is cleaned, but the funnel’s orphan-chain logic is still not matching Scoreboard / Per-SA.

## Plan

1. **Centralize “active intro run” rules**
   - Add a shared helper that excludes:
     - `result_canon = DELETED`
     - `result_canon = NO_SHOW`
     - `result_canon = VIP_CLASS_INTRO`
     - runs marked `ignore_from_metrics`
     - runs linked to VIP bookings
   - Keep `SECOND_INTRO_SCHEDULED` as a real ran intro because the member showed and booked a 2nd intro.

2. **Fix Conversion Funnel counting**
   - Update `computeFunnelBothRows` so it does not rely only on active booking IDs for “showed.”
   - For orphaned chains, count the real first ran intro once even if its original booking was soft-deleted.
   - Attribute the May 4 sale to the same journey without creating an extra ran count.
   - Expected result for this date range: **9 ran / 7 sold**, matching Studio Scoreboard and Per-SA.

3. **Make the alert more useful**
   - Update the metrics disagreement alert so, when the funnel disagrees, it can show the likely member/date causing the mismatch.
   - Include rows linked to deleted bookings in the audit explanation when they still affect a live sale chain.

4. **Add regression coverage**
   - Add a test for Alexa’s exact shape:
     - deleted original May 1 booking
     - deleted phantom May 1 child
     - deleted phantom May 1 run
     - active May 4 sale child
     - original May 1 run still linked to the deleted original
   - Assert the funnel counts Alexa as **1 ran / 1 sold**, not 2 ran or 0 ran.

## Files I expect to touch

- `src/components/dashboard/ConversionFunnel.tsx`
- `src/components/dashboard/MetricsConsistencyAlert.tsx`
- `src/lib/intros/orphanedFirstIntros.ts` or a new shared helper under `src/lib/intros/`
- A new/updated Vitest file for funnel/orphan-chain regression coverage

## Downstream effects

- Studio Scoreboard, Per-SA stats, and Conversion Funnel will use the same “ran intro” interpretation for deleted-origin chains.
- Alexa should disappear as a funnel discrepancy without needing another manual data deletion.
- Future duplicate/orphan cases should surface with clearer blame instead of only showing mismatched totals.