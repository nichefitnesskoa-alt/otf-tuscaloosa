

# Fix Prep Rate & Q Completion to Only Count Showed 1st Intros (Recaps Page)

## Problem
1. **Prep Rate denominator** uses `firstIntros.length` (all bookings in date range) instead of `showedBookingIds.size` (only members who showed up). A no-show morning intro inflates the denominator.
2. **Prep Rate numerator** counts all prepped bookings, even if the member no-showed. It should only count prepped bookings where the member actually showed.
3. **Future bookings today** are included because filtering only checks `isWithinInterval` on the date, not whether the booking's scheduled time has passed yet.

## Changes

### File: `src/pages/Recaps.tsx` (lines 63-89)

1. **Add time-aware filter** to `firstIntros`: reuse the `hasBookingPassed` pattern (check `class_date` + `intro_time` against `new Date()`) so today's future bookings are excluded.
2. **Fix Prep Rate denominator**: change from `firstIntros.length` to `qDenominator.length` (same as Q Completion — only showed members).
3. **Fix Prep Rate numerator**: intersect `preppedIds` with `showedBookingIds` so only prepped+showed bookings count.
4. **Result**: both Q Completion and Prep Rate return `undefined` (displayed as "—") when no 1st intros have been ran (showed) in the period.

```typescript
// Line 87-88 changes:
const preppedAndShowed = firstIntros.filter(b => showedBookingIds.has(b.id) && preppedIds.has(b.id));
setQCompletionRate(qDenominator.length > 0 ? (completedQIds.size / qDenominator.length) * 100 : undefined);
setPrepRate(qDenominator.length > 0 ? (preppedAndShowed.length / qDenominator.length) * 100 : undefined);
```

### File: `src/features/myDay/MyDayTopPanel.tsx`
Apply the same fix to the `useQAndPrepRates` hook (parallel implementation of the same logic).

| Fix | Before | After |
|-----|--------|-------|
| Prep denominator | All 1st intros in range | Only showed 1st intros |
| Prep numerator | All prepped bookings | Prepped AND showed |
| Future today bookings | Included | Excluded (time-aware) |
| 0 showed result | Shows 0% | Shows "—" |

