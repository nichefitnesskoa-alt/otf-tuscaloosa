## Goal
Make VIP-class sales attribute commission to the **SA who set up the VIP class** (`vip_sessions.sa_setup_name`), not the coach who taught it. The coach (`vip_sessions.coach_name`, e.g. Koa) keeps the teaching credit for close-rate purposes via the existing VIP-coach override. Studio Scoreboard sales and total commission must include these rows in every date range.

## What's wrong today
`src/lib/vip/convertVipPurchaseToIntro.ts` writes `intro_owner = vipCoach` on both `intros_booked` and `intros_run`. Verified with DB:

- Nothing Bundt Cakes (2026-06-29): `sa_setup_name = Kaiya`, `coach_name = Koa`, but all 5 SALE runs have `intro_owner = Koa`.
- Across all VIP-class SALE runs: 5 of 6 are mis-attributed to the coach instead of the setup SA.

Consequence: Kaiya gets $0 commission and 0 sales credit; Koa double-counts as SA owner *and* coach. Per-SA leaderboard, commission totals, and Conversion Credit table all show wrong people.

(Studio totals themselves — `studio.introSales`, `studio.totalCommission` — already include VIP because `isBookingExcludedFromMetrics` and `activeRuns` no longer drop VIP. The fix is purely *attribution*; aggregate Studio numbers will not change, only who owns them.)

## Changes

### 1. `src/lib/vip/convertVipPurchaseToIntro.ts`
- Add `vipSetupSaName: string | null` to `SaveArgs`.
- Resolve effective owner once at the top: `const introOwnerSa = (vipSetupSaName?.trim()) || saName;`
- Replace every `intro_owner: vipCoach` with `intro_owner: introOwnerSa` on both the booking insert/update and the run insert/update paths.
- Leave `coach_name: vipCoach` everywhere it currently appears (coach credit / VIP override is unchanged).
- Leave `sa_working_shift` / `booked_by` = `saName` (the SA who keyed the purchase in).
- Return the resolved `introOwnerSa` in `SaveResult` so the UI can show an honest toast.

### 2. `src/features/myDay/VipRegistrationsSheet.tsx`
- Extend the session fetch at line 95 to already-include `sa_setup_name` (it does). Store it in local state (`vipSaSetup` already exists).
- Pass `vipSetupSaName: vipSaSetup || null` into the `saveVipPurchase(...)` call at line 245.
- Update the success toast: `Purchase saved — $X to ${vipSaSetup || userName} (Coach: ${vipCoach})`.
- No other behavior changes.

### 3. Backfill existing VIP SALE rows (data migration via insert tool)
For every row in `intros_run` where:
- `result_canon = 'SALE'`
- `vip_session_id IS NOT NULL`
- `intro_owner IS DISTINCT FROM vip_sessions.sa_setup_name`
- `vip_sessions.sa_setup_name IS NOT NULL`

Set `intro_owner = vs.sa_setup_name`. Apply the identical update to the linked `intros_booked` row (`intros_run.linked_intro_booked_id`). Stamp `last_edited_by = 'System (VIP attribution fix)'`, `edit_reason = 'intro_owner reattributed from coach to SA who set up the VIP class'`, `last_edited_at = now()`.

Expected impact:
- 5 Bundt Cakes runs (Ray/Keke Crumpton, Renita Smith, Marganetta Graham, Jamie Finley): `intro_owner` flips from Koa → Kaiya.
- Their 5 linked `intros_booked` rows: same flip.
- 1 already-correct VIP SALE row left untouched.

## Coherence proof I will run after the change

```sql
-- 1. No VIP SALE run is still owned by the coach
SELECT count(*) FROM intros_run ir
JOIN vip_sessions vs ON vs.id = ir.vip_session_id
WHERE ir.result_canon='SALE' AND vs.sa_setup_name IS NOT NULL
  AND ir.intro_owner = ir.coach_name;
-- expect 0

-- 2. Bundt Cakes session is fully attributed to Kaiya
SELECT member_name, intro_owner, coach_name, commission_amount, buy_date
FROM intros_run WHERE vip_session_id='e8495208-65bc-4692-b750-35715dad808d'
  AND result_canon='SALE';
-- expect all 5 → intro_owner='Kaiya', coach_name='Koa', $15, 2026-06-29

-- 3. Linked bookings agree
SELECT count(*) FROM intros_booked ib
JOIN intros_run ir ON ir.linked_intro_booked_id = ib.id
WHERE ir.vip_session_id='e8495208-65bc-4692-b750-35715dad808d'
  AND ir.result_canon='SALE' AND ib.intro_owner <> 'Kaiya';
-- expect 0
```

Cross-page numbers I will name in the closing block (range containing 2026-06-29):
- **Studio Scoreboard** — `introSales` and `totalCommission` totals: unchanged in aggregate (VIP already counted), but Kaiya's row in Per-SA leaderboard gains +5 sales / +$75 commission; Koa's row loses those 5 / $75 from SA attribution while keeping all 5 as a coach close in Per-Coach.
- **Per-SA leaderboard** — Kaiya: +5 sales, +$75 commission, close-rate denominator +5 ran (Total Journey).
- **Per-Coach leaderboard** — Koa: unchanged (VIP coach override already routes these closes to him via `resolveCoachForBooking`).
- **Conversion Credit / commission report** — $75 moves from Koa's SA bucket to Kaiya's SA bucket; Koa's coach-credit unaffected.
- **Lead Source Analytics → VIP Class** — Booked 5 / Showed 5 / Sold 5 / 100% unchanged.
- **VIP Performance dashboard** — unchanged (reads `vip_registrations.outcome` directly).

## Forward behavior after the code change
Every future VIP purchase logged through `VipRegistrationsSheet` writes `intro_owner = vip_sessions.sa_setup_name` (fallback: the SA who is keying it in if setup was never claimed). Coach credit continues to flow via `coach_name` + the VIP override. No other call sites of `saveVipPurchase` exist (verified via rg).