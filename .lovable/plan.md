

# Restructure Follow-Up Categories to 5 Explicit Types

## Current State
The follow-up system uses 4 types: `noshow`, `missed`, `secondintro`, `reschedule`. The "missed" bucket merges "didn't buy 1st intro" and "didn't buy 2nd intro" together, and no-shows aren't split by 1st vs 2nd intro.

## New 5 Categories (exact button labels)
1. **No Show (1st Intro)** — `result_canon = 'NO_SHOW'` AND `isSecondIntro = false`
2. **No Show (2nd Intro)** — `result_canon = 'NO_SHOW'` AND `isSecondIntro = true`
3. **Planning to Reschedule** — same as current reschedule bucket
4. **Didn't Buy (1st Intro - Try to Reschedule 2nd)** — `result_canon = 'DIDNT_BUY'` AND `isSecondIntro = false`
5. **Didn't Buy (2nd Intro - Final Reach Out)** — `result_canon = 'DIDNT_BUY'` AND `isSecondIntro = true`, OR State B items (2nd intro ran, non-terminal)

## Changes

### File: `src/features/followUp/useFollowUpData.ts`
- Change `FollowUpType` from `'noshow' | 'missed' | 'secondintro' | 'reschedule'` to `'noshow_1st' | 'noshow_2nd' | 'reschedule' | 'didnt_buy_1st' | 'didnt_buy_2nd'`
- **No-Show processing (line ~256):** Split into `noshow_1st` or `noshow_2nd` based on `isSecondIntro`
- **Follow-Up Needed / Didn't Buy (line ~265):** Assign `didnt_buy_1st` (State A, 1st intro) or `didnt_buy_2nd` (State B, 2nd intro ran non-terminal)
- **State B processing (line ~281):** Assign `didnt_buy_2nd` instead of `missed`
- **Missed guests with no outcome (line ~311):** These are past bookings with no run — assign to `didnt_buy_1st` (they showed but no outcome was logged, treat as needing follow-up for 2nd intro booking)
- Remove the old `secondintro` type — unrun 2nd intro bookings go into `didnt_buy_1st` (they haven't come yet, so the SA needs to get them to show up for their 2nd)
- Update state variables, counts, and `allItems` to use 5 buckets instead of 4
- Remove the `secondIntro` arrays (merge unrun 2nd-intro bookings into `didnt_buy_1st` since they need to be rescheduled)

### File: `src/features/followUp/FollowUpList.tsx`
- Update `TYPE_LABELS` to the 5 new labels:
  - `noshow_1st`: `"No Show (1st Intro)"`
  - `noshow_2nd`: `"No Show (2nd Intro)"`
  - `reschedule`: `"Planning to Reschedule"`
  - `didnt_buy_1st`: `"Didn't Buy (1st Intro - Try to Reschedule 2nd)"`
  - `didnt_buy_2nd`: `"Didn't Buy (2nd Intro - Final Reach Out)"`
- Update `TYPE_COLORS` with 5 entries
- Update `FilterType` and the filter pills array to show all 5 categories plus "All" and "Transferred"
- Update script category mapping in `handleSendText`

### File: `src/features/followUp/FollowUpTabs.tsx` (if still used)
- Update tab labels and routing to match new 5-type system, or remove if the unified list is the active view

## What does NOT change
- Priority scoring logic (overdue/due today/first touch)
- Card layout (Send Text, Copy Phone, Log Outcome)
- Outcome drawer behavior
- Swipe-to-dismiss
- Coach follow-up list
- Pipeline, WIG, or any other page

