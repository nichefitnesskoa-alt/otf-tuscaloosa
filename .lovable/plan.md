Root cause found:
- Alexa has three booking rows tied to the same deleted original booking:
  - Deleted original first intro on May 1.
  - A May 1 follow-up row that points back to that deleted original.
  - A May 4 purchased row that also points back to that deleted original.
- The recent WIG fix promoted every non-deleted child of a deleted original into “first intro” status. That made WIG count Alexa twice: once for the May 1 follow-up row and once for the May 4 sale row.
- Studio still uses the old first-intro rule, so it excludes both child rows and never shows Alexa in James’s coached or closes drilldown.

Plan:
1. Add one shared helper for “metric base bookings” in `src/lib/intros/excludedBookings.ts`.
   - Keep existing exclusions: VIP, ignored, soft-deleted, duplicate/dead/deleted canon statuses.
   - Keep normal first intros.
   - Keep referred friends as first-intro equivalents.
   - For orphaned 2nd-intro chains where the originating booking is excluded, pick exactly one active child booking per original person-chain.
   - Prefer the child booking with a sale run. Otherwise prefer a real ran outcome over planning/follow-up duplicates, then the latest class date.
   - This makes Alexa resolve to the May 4 sale booking only.

2. Use that helper in the WIG Coach “Coached & Closes” section.
   - Replace the current `excludedOriginatingIds` promotion that includes all children.
   - Build WIG’s coached denominator, closes, and drilldown from the single resolved base booking list.
   - Result: James WIG shows Alexa once, with SALE, not both Follow-Up and SALE.

3. Use the same helper in Studio’s Per-Coach table and drilldown.
   - Replace Studio’s old `!originating_booking_id` filter.
   - Studio and WIG will now include the same resolved person-chain for James.
   - Result: Alexa appears in James’s Studio coached and closes drilldowns as a sale.

4. Update Studio aggregate metrics in `src/hooks/useDashboardMetrics.ts` to use the same resolved first-intro/base-booking logic.
   - This keeps the Studio scoreboard denominator and sales total aligned with the person lists.
   - Sales stay anchored to buy date, ran/coached stays anchored to class/run date.

5. Add regression tests around the exact failure mode.
   - Deleted original + follow-up child + sale child should count one ran/coached and one sale.
   - No duplicate Alexa-style rows in the resolved base list.
   - Normal first intros and referred-friend bookings still count correctly.

Downstream effect:
- WIG and Studio drilldowns for James should match for Alexa.
- Alexa Brodsky should show once as ran/coached and once as closed/sale.
- Jaden Cerreta and Ethan Forman remain excluded because their bookings are soft-deleted and do not have a valid active sale child promoted as the real intro.