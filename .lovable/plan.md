# Fix Alexa's duplicate + add Delete Run + duplicate-runs alert

## Ground truth
9 intros ran, 7 sold. Scoreboard and Per-SA already show this correctly — Alexa is counted once (as a 1st intro at her May 4 sale). The Conversion Funnel is the wrong one; it shows 10 because a phantom duplicate booking is being counted as a separate 2nd-intro showing.

## What's actually duplicated (verified in DB)

| Run | Date | Result | Linked booking | Booking status |
|---|---|---|---|---|
| `dfb8b13a…` | May 1 | Booked 2nd intro (Nora) | `467a…` | Soft-deleted (real original) |
| `f59655d5…` | May 1 | Follow-up needed (Koa) | `0b19…` | Active, child of `467a…` ← **phantom** |
| `2375d2ca…` | May 4 | Premier sale | `b647…` | Closed – Bought, child of `467a…` |

`0b1929d1…` is a duplicate booking auto-created when Nora marked the original's outcome. Its May 1 follow-up run describes the same class as Nora's original run. Deleting both drops the Funnel from 10 → 9 and Alexa is left with: original May 1 run (counted via orphan promotion at the May 4 sale child) + the May 4 sale run.

## Plan

### 1. One-time data cleanup (Supabase update)
- `intros_run` `f59655d5-0b6f-4656-937d-f04521331647` → `result_canon='DELETED'`, `result='Deleted'`, `commission_amount=0` (matches `DeleteSaleDialog` soft-delete pattern).
- `intros_booked` `0b1929d1-64b1-4b80-9c24-4e3729fc5b2f` → `deleted_at=now()`, `booking_status='Deleted (soft)'`, `booking_status_canon='DELETED_SOFT'`.

Result: Scoreboard 9, Per-SA 9, Funnel 9, all sales 7. Drift alert clears.

### 2. Admin "Delete Intro Run" dialog
New `src/components/admin/DeleteIntroRunDialog.tsx` modeled on `DeleteSaleDialog`. Soft-deletes by setting `result_canon='DELETED'`, `result='Deleted'`, `commission_amount=0`. Confirmation shows member name, run date, current result, owner.

Mounted in admin-only spots:
- `MembershipPurchasesPanel.tsx` — extend the existing trash icon to non-sale runs too.
- `ClientJourneyPanel.tsx` — per-run trash icon.
- `features/pipeline/components/PipelineRowCard.tsx` — admin-only "Delete Run" in the row's actions.

Gated on `isAdmin`. SAs and Coaches never see it.

### 3. Duplicate Runs audit + on-screen alert
New `src/components/dashboard/DuplicateRunsAlert.tsx` (mirrors `MetricsConsistencyAlert` styling — red card, AlertTriangle, table). Mounted on `Recaps.tsx` admin view above `MetricsConsistencyAlert`.

Detection (pure client-side over `useData()`):
> Group active `intros_run` rows (exclude `result_canon` in DELETED, VIP_CLASS_INTRO) by lowercased `member_name + run_date`. Flag any group with >1 row.

Each flagged row shows: member, date, count, list of result + owner per run, and a per-run "Delete" button that opens `DeleteIntroRunDialog`. Hidden when zero duplicates.

Helper extracted to `src/lib/intros/duplicateRuns.ts` + Vitest covering: same-day same-member flagged, deleted runs ignored, VIP runs ignored, different dates not flagged.

## Files
**Created:** `DeleteIntroRunDialog.tsx`, `DuplicateRunsAlert.tsx`, `lib/intros/duplicateRuns.ts` + test.
**Modified:** `MembershipPurchasesPanel.tsx`, `ClientJourneyPanel.tsx`, `PipelineRowCard.tsx`, `pages/Recaps.tsx`. One Supabase data update for the Alexa cleanup.

## Expected result
- Pipeline shows Alexa with 1 May 1 run + the May 4 sale (no duplicate).
- Scoreboard / Per-SA / Conversion Funnel all read **9 ran / 7 sold / 78%**.
- Metrics-disagree alert clears.
- Duplicate-runs alert hidden (zero duplicates).
- Admin can soft-delete any future duplicate run with one click from Recaps, Pipeline, or Client Journey.
