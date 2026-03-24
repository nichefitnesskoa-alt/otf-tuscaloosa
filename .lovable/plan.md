

# Auto-Hide Recently Contacted Follow-Ups + Auto-Log on Script Send

## Problem
1. Sending a script via "Send Text" already logs a `script_sent` action, but cards stay visible in the follow-up queue even if contacted within the last 7 days.
2. The "Log as Sent" button is separate and confusing — people don't know if the contact was tracked.
3. Cards should hide (or clearly indicate cooling) when contacted recently.

## Changes

### 1. Follow-Up Data Hook — 7-Day Cooling Filter (`useFollowUpData.ts`)
- After building all four arrays (noShow, missedGuests, secondIntro, plansToReschedule), split each into two groups:
  - **"cooling"**: `lastContactAt` exists and is < 7 days ago
  - **"active"**: everything else
- Active items show normally. Cooling items are pushed to the bottom of each tab with a distinct visual treatment (dimmed, with a "Contacted X ago — next contact in Y days" banner).
- Alternatively (simpler): just hide cooling items entirely since the ContactedBanner already exists. The user's request is "they don't need to be showing up in here" — so **hide them**.
- Add a "Show recently contacted (N)" toggle at the bottom of each tab so they can still be found if needed.

### 2. Auto-Log on Script Copy — Already Works, But Refresh Is Missing (`MessageGenerator.tsx`)
- After `handleCopy` inserts the `script_actions` row, dispatch a `myday:refresh` event so the follow-up tabs re-fetch and the card either hides (cooling) or shows the updated ContactedBanner.
- Also dispatch from `handleLog` (the explicit log button).

### 3. Remove Redundant "Log as Sent" When Script Was Just Sent
- In each follow-up tab (NoShowTab, FollowUpNeededTab, SecondIntroTab, PlansToRescheduleTab), after "Send Text" opens the script picker and the user copies/sends, the card should auto-refresh and show the ContactedBanner. The "Log as Sent" button remains for cases where the SA contacted outside the app (phone call, in-person).

### 4. ContactedBanner Enhancement (`ContactedBanner.tsx`)
- Change the hide logic: instead of hiding when `contactNextDate` has passed, hide when `lastContactAt` is older than 7 days. This ensures the banner persists for the full cooling window.
- Add "next contact in X days" text to the banner.

## Files Changed

| File | Change |
|------|--------|
| `src/features/followUp/useFollowUpData.ts` | Filter out items where `lastContactAt` < 7 days ago; expose `coolingCount` per tab for toggle |
| `src/features/followUp/NoShowTab.tsx` | Add "Show recently contacted (N)" toggle; items with cooling show dimmed at bottom |
| `src/features/followUp/FollowUpNeededTab.tsx` | Same toggle pattern |
| `src/features/followUp/SecondIntroTab.tsx` | Same toggle pattern |
| `src/features/followUp/PlansToRescheduleTab.tsx` | Same toggle pattern |
| `src/components/scripts/MessageGenerator.tsx` | Dispatch `myday:refresh` after `handleCopy` and `handleLog` so follow-up cards update immediately |
| `src/components/shared/ContactedBanner.tsx` | Add "next contact in X days" text; use 7-day window instead of `contactNextDate` for hide logic |

## Technical Detail

The cooling filter in `useFollowUpData.ts`:
```typescript
const COOLING_DAYS = 7;
function isCooling(item: FollowUpItem): boolean {
  if (!item.lastContactAt) return false;
  const hoursSince = differenceInHours(new Date(), new Date(item.lastContactAt));
  return hoursSince < COOLING_DAYS * 24;
}
```

Each tab receives both `activeItems` and `coolingItems`. By default only `activeItems` render. A small toggle shows cooling items when expanded.

