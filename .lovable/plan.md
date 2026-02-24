

# Fix: 2nd Intro Time Not Pre-Populating

## Root Cause

When a "Booked 2nd intro" outcome is saved, the new `intros_booked` record is created with `class_start_at` (e.g., `2026-02-26T06:15:00`) but **`intro_time` is never set** (line 326 of `applyIntroOutcomeUpdate.ts`).

The OutcomeDrawer fetches `intro_time` from the linked booking (line 114), gets `null`, and the time field stays blank — even though the time is embedded in `class_start_at`.

The blue banner shows the date correctly because it only uses `class_date`, but time is missing because `intro_time` is null.

## Changes

### 1. `src/lib/domain/outcomes/applyIntroOutcomeUpdate.ts`
In the Step 6 insert (line 323), add `intro_time` extracted from the draft's `class_start_at`:

```ts
intro_time: draft.class_start_at.split('T')[1]?.substring(0, 5) || null,
```

This ensures future 2nd intro bookings always have `intro_time` set.

### 2. `src/components/myday/OutcomeDrawer.tsx`
In the fetch query (line 114), also select `class_start_at`. In the result handler, fall back to extracting HH:mm from `class_start_at` when `intro_time` is null:

```ts
time: data.intro_time || data.class_start_at?.split('T')[1]?.substring(0, 5) || '',
```

This fixes pre-population for existing records that already have `class_start_at` but no `intro_time`.

## Files Changed

| File | Change |
|------|--------|
| `src/lib/domain/outcomes/applyIntroOutcomeUpdate.ts` | Add `intro_time` to 2nd intro booking insert |
| `src/components/myday/OutcomeDrawer.tsx` | Fallback to `class_start_at` for time when `intro_time` is null |

