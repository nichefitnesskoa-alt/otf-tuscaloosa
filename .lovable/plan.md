

## Plan: Coach Close Counts, Pack Redemption Tracking, New Lead Source

Four changes to the WIG page and lead sources.

---

### Change 1 — Coach Lead Measures: Add Closes Column + Rename Overall

**File: `src/pages/Wig.tsx`**

- In the coach data computation (~line 443), add `closes: cl.closed` to the returned object (it already has `closeRate` and `closeTotal`).
- Reorder table columns to: Coach | Coached | Closes | Close % | Overall WIG % | Pre % | Post % | Got Curious % | Pairing %
- Rename "Overall %" header to "Overall WIG %"
- Add a new `<TableCell>` for Closes showing `row.closes` (the `cl.closed` count — already computed but not exposed)
- The data already filters to first intros only and uses Total Journey logic. Verify `closeTotal` is used as the denominator (it is — line 451). No logic changes needed.

### Change 2 — Celebrations: Track Pack Redemption & Conversion

**File: `src/components/dashboard/MilestonesDeploySection.tsx`**

The friend from a pack is already added to the `leads` table with `converted_to_lead_id` linking back. To check if they showed up and converted:

- In `loadData()`, after fetching milestones, for each milestone with `five_class_pack_gifted = true` AND `friend_name` set:
  - Query `intros_booked` for `member_name` matching `friend_name` (case-insensitive) to check if they have bookings
  - Query `intros_run` for any linked runs with `result_canon = 'SALE'` to check conversion
  - Also check if lead_source matches "Member Referral (5 class pack)" on their bookings
- Store results in a map: `friendId → { classesRedeemed: number, convertedToMember: boolean }`
- Add two new summary cards: "Classes Redeemed" (total bookings by pack friends that showed) and "Converted to Member" (count of pack friends with a sale)
- On each celebration row where `five_class_pack_gifted = true`, show badges:
  - "X classes redeemed" (green if > 0, muted if 0)
  - "Converted" (green) or "Not yet converted" (muted)

### Change 3 — New Lead Source: "Member Referral (5 class pack)"

**File: `src/types/index.ts`**
- Add `'Member Referral (5 class pack)'` to `LEAD_SOURCES` array (alphabetically after 'Member Referral')

**File: `src/components/dashboard/MilestonesDeploySection.tsx`**
- When creating a lead from a celebration friend (`checkPipelineAndCreateLead`), change the source from `'Milestone Referral'` to `'Member Referral (5 class pack)'`

**File: `src/components/dashboard/BookIntroSheet.tsx`**
- No special picker needed for this source — it's a standard booking

### Change 4 — Ensure Total Journey on Coach Close Data

Already confirmed: the coach close rate computation (lines 408-430) only looks at `showedFirstIntroBookings` which filters `!b.originating_booking_id || !!b.referred_by_member_name`. However, Total Journey means if a 2nd intro results in a sale, the coach of the 1st intro gets credit. Current logic only checks runs linked to first-intro bookings — it misses sales on 2nd intros.

**Fix in `src/pages/Wig.tsx`** (~line 408-430):
- After getting runs for first-intro bookings, also check if there's a 2nd-intro booking (via `originating_booking_id`) that has a SALE result
- For each first-intro booking ID, query if any booking in `intros_booked` has `originating_booking_id = firstIntroId` and its linked run has `result_canon = 'SALE'`
- This mirrors the PerCoachTable logic already in the codebase

---

### Files Changed
1. `src/pages/Wig.tsx` — add Closes column, rename Overall WIG %, fix Total Journey
2. `src/components/dashboard/MilestonesDeploySection.tsx` — pack redemption tracking, update lead source
3. `src/types/index.ts` — add "Member Referral (5 class pack)"

