

## Goal

Stop intro cards from disappearing when their VIP class is linked. Linking a member's intro to the VIP class they came from is **attribution-only** — it must never flip them into the VIP-funnel exclusion bucket.

## Root cause

Three places set `is_vip = true` on the `intros_booked` row whenever a `vip_session_id` is attached:

1. `src/lib/vip/backfillVipSessionLinks.ts` (auto-backfill) — recently added
2. `src/components/shared/IntroCard.tsx` (manual VIP class picker) — line 289
3. `src/components/dashboard/BookIntroSheet.tsx` already sets `is_vip: false` (correct), so this one is fine

But `is_vip = true` is the canonical flag for "this row is a VIP group session, exclude from intros funnel." The My Day fetch in `useUpcomingIntrosData.ts` (line 415) filters them out: `activeItems.filter(i => !i.isVip)`.

So the moment Huntley's card got auto-linked to the Kappa Delta VIP class, `is_vip` flipped to `true` and she dropped off the My Day list on next refresh. Same thing has been silently happening to anyone whose VIP class was manually linked from the card — they just didn't notice because the in-memory list didn't refilter until the next fetch.

The two concepts must be separated:
- `vip_session_id` = "this intro came from a VIP class" (attribution, badge, performance link) — safe to set
- `is_vip` = "this row IS a VIP group session, not a real intro" (funnel exclusion) — must stay `false` for normal intro bookings

## Changes

### 1) `src/lib/vip/backfillVipSessionLinks.ts` — remove `is_vip: true` from update payload

Update payload becomes:
```
vip_session_id: det.sessionId,
vip_class_name: className,
last_edited_at: ...,
last_edited_by: 'auto-vip-detect',
```

`is_vip` is left untouched. Existing rows that genuinely are VIP group sessions already have `is_vip = true` set by their own creation path; we never need to flip it from a backfill.

### 2) `src/components/shared/IntroCard.tsx` — remove `is_vip: true` from the manual VIP-class link payload

Around line 289, drop `is_vip: true`. Keep `vip_session_id`, `vip_class_name`, `last_edited_at`, `last_edited_by`. Same reasoning — manually attaching the VIP class an intro came from is attribution, not a type change.

### 3) One-shot SQL repair migration for already-corrupted rows

Any intros that got `is_vip = true` flipped on by the recent backfill or by previous manual links need to be repaired so they reappear on My Day. Migration logic:

```
UPDATE intros_booked
SET is_vip = false
WHERE is_vip = true
  AND booking_type_canon = 'STANDARD'
  AND (
    last_edited_by = 'auto-vip-detect'
    OR vip_session_id IS NOT NULL
  )
  AND deleted_at IS NULL;
```

Safety guard: only flip rows where `booking_type_canon = 'STANDARD'`, so genuine VIP group session rows (which use `booking_type_canon = 'VIP'`) are never touched. This restores Huntley and any other auto-flipped intros immediately.

## Files touched

- Modified: `src/lib/vip/backfillVipSessionLinks.ts` — drop `is_vip: true` from update
- Modified: `src/components/shared/IntroCard.tsx` — drop `is_vip: true` from manual link update
- New migration: repair `is_vip` on standard intro bookings that were incorrectly flipped

## What does NOT change

- VIP isolation rules unchanged — true VIP group sessions (`booking_type_canon = 'VIP'`) still excluded from the intros funnel
- `vipRules.isVipBooking` predicate unchanged — it correctly handles all three signals (`is_vip`, `booking_type_canon = 'VIP'`, `vip_session_id`); we're just no longer feeding it false positives
- VIP class badge on the card face still shows when `vip_session_id` / `vipClassName` is present (no UI change needed — IntroRowCard already renders `VIP Class: …` from `vipClassName`)
- Attribution math, conversion math, performance tables, `VipClassPerformanceTable`, friend handling, questionnaire flow: all unchanged
- Role permissions: unchanged
- Central Time conventions: unchanged

## Downstream effects implemented in this build

- Huntley Marshall's card reappears immediately on next My Day load with the linked VIP class still showing
- Any other intro that was silently auto-hidden by the recent backfill returns to My Day
- Future auto-links and manual VIP class links on intro cards no longer make those cards disappear
- VIP class attribution still flows to `VipClassPerformanceTable` (it joins on `vip_session_id`, not `is_vip`)
- Real VIP group sessions on My Day intros tab continue to be excluded as before
- No regression to friend-vs-organizer logic — friend bookings keep `is_vip = false` and stay visible with their `VIP Class (Friend)` source badge

