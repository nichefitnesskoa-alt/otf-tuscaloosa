

# Fix 2nd Intro Cards + Add Editable Time + Follow-up Outcome + Remove Inline Badge

## Issues Identified

1. **Inline outcome badge (lines 291-308)** — the circled button from the screenshot. Needs removal; bottom banner is sufficient.
2. **Copy Phone missing on 2nd intro cards** — The Copy Phone button (line 451) already exists for all cards with a phone. However, 2nd intro cards may not have phone data populated because the 2nd intro booking is auto-created and may not copy the phone from the original booking. Need to verify/fix the phone inheritance.
3. **Time not showing on 2nd intro cards** — `intro_time` may not be getting set when the 2nd intro booking is auto-created via `applyIntroOutcomeUpdate`. The card displays `formatDisplayTime(item.introTime)` which shows nothing if `intro_time` is null.
4. **Times need to be editable inline on all cards** — Currently there's no way to edit the intro time directly on the card. Need an inline edit capability.
5. **"Follow-up needed" missing from outcome drawer** — Need to add it back to `NON_SALE_OUTCOMES`.

## Plan

### 1. Remove inline outcome badge from IntroRowCard (`src/features/myDay/IntroRowCard.tsx`)

Remove lines 291-308 (the `item.latestRunResult` button/badge in Row 2). The bottom banner (lines 510-536) already shows this.

### 2. Add "Follow-up needed" to outcome options (`src/components/myday/OutcomeDrawer.tsx`)

Add `{ value: 'Follow-up needed', label: '📋 Follow-up needed' }` to the `NON_SALE_OUTCOMES` array (after "Not interested", before "Booked 2nd intro"). When selected, it should create a follow-up queue entry similar to "Planning to Reschedule" behavior.

### 3. Make intro time editable inline on cards (`src/features/myDay/IntroRowCard.tsx`)

- Replace the static time display (line 247) with a tappable element that opens an inline time input
- Add state: `editingTime` boolean, `editTimeValue` string
- On tap, show a `<input type="time">` inline; on blur/confirm, update `intros_booked.intro_time` and `class_start_at` via supabase
- Works for both 1st and 2nd intro cards
- If time is missing (null), show a red "Add Time" prompt that forces time entry

### 4. Ensure 2nd intro bookings inherit phone from original (`src/lib/domain/outcomes/applyIntroOutcomeUpdate.ts`)

Check if the auto-created 2nd intro booking copies `phone`, `phone_e164`, and `email` from the original booking. If not, add that to the insert. This is the root cause of missing phone/time on 2nd intro cards.

## Files Changed

| File | Change |
|------|--------|
| `src/features/myDay/IntroRowCard.tsx` | Remove inline outcome badge (lines 291-308); add inline editable time with "Add Time" prompt when missing |
| `src/components/myday/OutcomeDrawer.tsx` | Add "Follow-up needed" to `NON_SALE_OUTCOMES`; add follow-up queue creation logic when selected |
| `src/lib/domain/outcomes/applyIntroOutcomeUpdate.ts` | Ensure 2nd intro auto-creation copies phone, phone_e164, email, and intro_time from original booking |

