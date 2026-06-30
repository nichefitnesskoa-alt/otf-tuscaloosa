## Problem

The 5 VIP purchases on the Nothing Bundt Cakes session (6/29) are correctly written to `intros_booked` + `intros_run` with `result_canon = 'SALE'`, `commission_amount = 15`, and `lead_source = 'VIP Class'`. They show up as "Showed" in Lead Source Analytics, but the **Sold** column shows 0.

**Root cause:** `saveVipPurchase()` (in `src/lib/vip/convertVipPurchaseToIntro.ts`) sets the run's `buy_date` to **today** (when the SA clicks "Purchased"), not to the **VIP session date**. Studio metrics (`isSaleInRange`) anchor sales strictly to `buy_date`. Anyone logging an outcome a day (or week) after the actual VIP class falls out of the period that contains the class.

Verified in DB: all 5 rows have `class_date = 2026-06-29`, `buy_date = 2026-06-30` — so they're invisible to any date range ending on or before 6/29 (which is the period the user is viewing).

This is identical to the per-person VIP outcome contract: the sale happened on the VIP class day, so every downstream metric (Studio Scoreboard, Lead Source Analytics, Per-Coach / Per-SA, WIG sales, commission attribution by pay period, Activity Log) must treat the class day as the transaction day.

## Fix

### 1. Anchor VIP purchases to the session date (single source of truth)
In `src/lib/vip/convertVipPurchaseToIntro.ts → saveVipPurchase`:
- Change `buy_date` from `today` to `vipSessionDate` on both **create** and **update** paths for `intros_run`.
- `run_date` already uses `vipSessionDate` (correct).
- Keep the registration's `purchased_at` as `now()` (that field is "when was this logged", not "when did the sale happen" — useful for audit trail).

### 2. Backfill the 5 existing Bundt Cakes rows
One `UPDATE intros_run SET buy_date = '2026-06-29' WHERE id IN (...)` covering the 5 run IDs already linked to these registrations. Also sweep any other VIP-converted run where `buy_date <> linked booking's class_date` so older mis-stamped rows align too.

### 3. Coherence proof
Verify with `read_query`:
- The 5 runs now have `buy_date = 2026-06-29`.
- Studio Lead Source Analytics: VIP Class shows **Booked 5 / Showed 5 / Sold 5 / 100% booked→sale** for the date range containing 6/29.
- Studio Scoreboard `intro_sales` and `total_commission` include +5 / +$75 for that range.
- Per-Coach (Koa) close-rate denominator includes the 5 showed and numerator includes the 5 sold.
- Per-SA (Kaiya) credit picks up the 5 sales (VIP coach gets the sale credit per intro_owner=Koa rule, but Kaiya's "VIP class found" still reflects on her board — confirm both surfaces agree with the existing rule).
- VIP performance dashboard tile counts unchanged (5 purchased on that session).

### Files touched
- `src/lib/vip/convertVipPurchaseToIntro.ts` — one-line change on each of two writes
- One data migration via `insert` tool — backfill `buy_date` on already-converted VIP runs

### Not changed
- VIP roster UI, outcome dropdown, attendance auto-count — already work
- `softCancelVipPurchase` — date doesn't matter on cancel
- Any non-VIP sale path — unaffected
