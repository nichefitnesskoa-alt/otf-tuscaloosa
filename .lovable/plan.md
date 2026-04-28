I want the pipeline journey to also reflect that they took a VIP class as well. not just show up after their first intro after. That should solve a lot of problems too  
  
Three fixes

### 1. Coach "My Intros" — hide people who bought (Total Journey)

**File:** `src/pages/CoachMyIntros.tsx`

Right now an intro stays on the list even after the member buys on a later visit (e.g., Shelby Millinder shows as "Unresolved"). It's only marked SALE if the run linked directly to that booking is a SALE. We need Total Journey logic: if **any** booking in the chain (this booking, its 2nd intro, or its originating booking) ended in a sale, treat this intro as "Joined" and hide it from the active queue.

Changes:

- In `fetchData`, also pull all related bookings/runs in the chain. Easiest: build two maps after the existing fetch:
  - `chainSaleByBookingId`: for each of the coach's bookings, check if any `intros_run` row in the entire `intros_run` set has `result_canon = 'SALE'` (or `isMembershipSale(result)`) AND links to either (a) this booking, (b) a booking whose `originating_booking_id = this.id`, or (c) the booking referenced by `this.originating_booking_id`.
  - To do this we need a wider fetch: pull `intros_booked` rows (id, originating_booking_id) for every `originating_booking_id` referenced by the coach's bookings AND every booking that has one of the coach's bookings as its originating, plus pull `intros_run` for any of those bookings. One query: `select id, originating_booking_id from intros_booked where id in (...) or originating_booking_id in (...)`. Then `select linked_intro_booked_id, result, result_canon from intros_run where linked_intro_booked_id in (chain ids)`.
- When merging, set `resultCanon = 'SALE'` whenever the chain has a sale (overriding `UNRESOLVED`/`DIDNT_BUY`/`NO_SHOW`). This automatically routes the intro to "Caught up" (tier 5) via existing `computePriority`, and the badge becomes "Joined".
- Filter the rendered list (or in the `filtered` memo) so `'all'` and any non-`joined` filter exclude `resultCanon === 'SALE'`. Only the "Joined" filter shows them. This matches the user's intent: bought people leave the active list.

### 2. VIP Class intros — credit the VIP class coach in Studio Sales

**File:** `src/components/admin/MembershipPurchasesPanel.tsx`

Today the "Coach" column reads `intros_booked.coach_name`, which is the next intro's coach (Natalya), not the VIP class coach. Apply the same resolver pattern already used in `PerCoachTable.tsx`:

- After fetching `bookings`, collect `vip_session_id`s from any booking whose `lead_source` starts with `"VIP Class"` and `vip_session_id` is set.
- Fetch those `vip_sessions` rows (`id, coach_name`) and build `vipCoachByVipSession` map.
- Extend the `bookingMap` value to also include `vipSessionId` and `leadSource` (already there).
- When building each purchase row, if `bookingInfo.leadSource?.startsWith('VIP Class')` and a VIP coach exists for `bookingInfo.vipSessionId`, use that as `coach`. Otherwise fall back to `bookingInfo.coach`.

This makes Jill Gaylard (and every VIP-class-sourced sale) credit the VIP class coach, matching the canonical attribution rule already enforced in coach performance and commission.

### 3. Add Kaiya & Jayna to staff dropdowns everywhere

**File:** `src/types/index.ts`

`Kaiya` and `Jayna` exist in the `staff` table (both active SAs), but every dropdown in the app reads from the hardcoded `SALES_ASSOCIATES` / `COACHES` / `ALL_STAFF` arrays in `src/types/index.ts`. Add them:

```ts
export const SALES_ASSOCIATES = [
  'Bre','Bri','Elizabeth','Grace','Jayna','Kailey','Katie','Kaiya','Kayla','Koa','Lauren','Nora','Sophie'
] as const;
```

`COACHES` stays the same (they aren't coaches). `ALL_STAFF` is auto-derived from both arrays, so it picks them up automatically. This single change propagates to all 16 files that import these constants — including the Pipeline "Intro Owner" dropdown shown in your screenshot, Edit Sale, Set Owner, Book Intro, Outcome Drawer, etc.

## Downstream effects implemented

- Coach My Intros priority/filter logic, "Caught up" totals, urgent-count banner all reflect bought members being removed from active.
- Studio → Membership Purchases → Coach column updates for both Intro Sales and Outside Sales views (Outside Sales already had no coach value, so unchanged).
- Per-Coach Performance table (`PerCoachTable.tsx`) — already uses VIP resolver; no change needed but consistent.
- All 16 files reading `SALES_ASSOCIATES`/`ALL_STAFF` (Pipeline dialogs, Edit Sale, Book Intro Sheet, Walk-In Sheet, Outcome Drawer, VIP scheduler/convert, Fix Booking Attribution, Client Journey, Data Health, Follow-Ups Due Today, IntroBookingEntry, IntroRunEntry, IntroCard, VipRegistrationsSheet) instantly include Kaiya and Jayna.

## Files changed

- `src/pages/CoachMyIntros.tsx` — chain-sale lookup + filter bought from active
- `src/components/admin/MembershipPurchasesPanel.tsx` — VIP coach resolver
- `src/types/index.ts` — add Kaiya, Jayna to SALES_ASSOCIATES

## Out of scope (not touched)

- VIP class coach resolution in any other report (only Membership Purchases was called out and already-correct elsewhere will be re-verified, no edits).
- The `staff` table itself (Kaiya/Jayna already exist as active).
- No DB migrations.