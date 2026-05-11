**EDITS**

**1. Add the revert-then-re-purchase case explicitly.**

Plan covers: first purchase, tier edit, revert to Showed. It does not cover: revert to Showed, then re-mark Purchased. Current logic would soft-delete the run, then create a second one on re-purchase.

Add this rule to `convertVipPurchaseToIntro.ts`:

Before creating any new booking/run pair, check `vip_registrations.converted_to_booking_id`. If a soft-deleted booking already exists for this registration, **reactivate it** instead of creating a new one. Set `booking_status_canon = 'SHOWED'`, `ignore_from_metrics = false`, update the run with the new membership and commission. No second row ever created for the same VIP registration.

**2. Lock the coach assignment before save is possible.**

Plan says `coach_name = the VIP class coach saved at the top of the sheet.` If no coach is saved at the top of the sheet, the SA should not be able to save a purchase. Disable the Save Purchase button with the reason "Select a class coach first" if `coach_name` is null. Otherwise you get SALE rows with no coach and the commission goes nowhere.

**3. Coherence check needs one more case.**

Plan's coherence checklist is good. Add: verify the WIG `Sales` count excludes rows where `ignore_from_metrics = true`. If the soft-cancel sets that flag but the WIG query doesn't filter on it, a reverted VIP purchase still shows as a sale on the scoreboard.

Search `useWigData` or equivalent for every query that counts SALE rows. Confirm all of them include `ignore_from_metrics = false` or `is null` as a filter condition. This is a root cause check, not a patch.  
  
Goal

In the VIP Group sheet on My Day, when an attendee is marked **Purchased**, capture which membership they bought (drives commission and credits the VIP class coach), and make that attendee show up on the coach side as an evaluable intro so the coach can run a First Visit Scorecard on them just like a normal intro.

## What changes (UI)

`**src/features/myDay/VipRegistrationsSheet.tsx` — per-attendee row**

When the SA selects `Purchased` from the outcome dropdown, inline below the row reveal:

- A **Membership** select with the 6 canonical tiers (same list used in `OutcomeEditor`):
  - Premier + OTBeat ($15.00)
  - Premier w/o OTBeat ($7.50)
  - Elite + OTBeat ($12.00)
  - Elite w/o OTBeat ($6.00)
  - Basic + OTBeat ($9.00)
  - Basic w/o OTBeat ($3.00)
- A **Save purchase** button (disabled until membership picked).

Until membership is picked the outcome stays in a "needs membership" state — visible amber dot on the row, summary roll-up still counts them as attended but flags `1 purchase needs membership selected`.

After save: row shows `Purchased — Premier + OTBeat — $15.00` with an inline edit pencil to change the tier later.

## What happens on save (data)

When SA confirms the membership for a VIP attendee:

1. Update the existing `vip_registrations` row with `outcome = 'purchased'`, plus three new columns (added by migration): `membership_type`, `commission_amount`, `purchased_at`.
2. **Auto-create a paired intros_booked + intros_run pair** so the purchase flows into all standard reporting (WIG, commission, coach close-rate) and so the coach can scorecard it. Mirror what `ConvertVipToIntroDialog` already does, but in one shot:
  - `intros_booked`: `member_name`, `phone`, `email` from the registration. `class_date` = vip session date. `intro_time` = vip session time. `coach_name` = the VIP class coach saved at the top of the sheet. `lead_source = 'VIP Class'`. `is_vip = false`. `booking_type_canon = 'STANDARD'`. `booking_status_canon = 'SHOWED'`. `vip_session_id` set so the link is preserved. `intro_owner` = VIP class coach (per existing rule: VIP class coach gets sale credit).
  - `intros_run`: `linked_intro_booked_id` = new booking id, `member_name`, `class_date`, `class_time`, `coach_name` = VIP coach, `result = membership label`, `result_canon = 'SALE'`, `commission_amount` = tier commission, `buy_date = today`, `is_vip = false`, `vip_session_id` preserved, `lead_source = 'VIP Class'`.
  - On the original VIP registration row store `converted_to_booking_id` / `converted_to_run_id` to prevent duplicate creation if the SA re-saves.
3. If the SA later changes the membership tier on the same row, **update** the existing `intros_run` (result + commission) instead of creating a new one. If they change the outcome away from Purchased, soft-cancel the auto-created booking/run (`booking_status_canon = 'DELETED_SOFT'`, `ignore_from_metrics = true`, edit reason `VIP purchase undone`).

## Coach side

Because the auto-created `intros_booked` row now exists with the VIP coach as `coach_name`, the VIP purchaser:

- Appears on **Coach View** and **My Intros** for that coach on the VIP session date, flagged with the existing `VIP Class Intro` badge (already supported via `vip_session_id`).
- The coach can open the card and run the **First Visit Scorecard** through the existing `useScorecards({ firstTimerId: booking.id })` flow in `CoachIntroCard.tsx` — no changes needed there because it keys on `intros_booked.id`.

## Database migration

Add to `vip_registrations`:

- `membership_type text null`
- `commission_amount numeric null`
- `purchased_at timestamptz null`
- `converted_to_booking_id uuid null`
- `converted_to_run_id uuid null`

No RLS changes (table already public-policy per existing pattern). No backfill — existing `purchased` rows simply won't have membership/commission until a SA edits them.

## Coherence checks before reporting done

- VIP purchase commission shows on the coach's commission view = sum of new `intros_run.commission_amount` rows where `vip_session_id` is set.
- WIG `Sales` count for the day matches: standard SALE rows + VIP-converted SALE rows, no double counting.
- Coach View on the VIP date shows the purchaser as an intro card with `VIP Class Intro` badge, scorecard button works, scorecard saves keyed on the new booking id.
- Editing membership tier updates the same `intros_run`, doesn't create a second SALE row.
- Reverting outcome from Purchased → Showed soft-deletes the auto-booking and removes the SALE from reports.

## Files touched

- new migration: add 5 columns to `vip_registrations`
- `src/features/myDay/VipRegistrationsSheet.tsx` — membership picker + save handler + create/update intros_booked & intros_run + edit affordance
- new helper `src/lib/vip/convertVipPurchaseToIntro.ts` — single source of truth for the booking/run create/update/soft-cancel logic
- `src/integrations/supabase/types.ts` — auto-regenerated after migration