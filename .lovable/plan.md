

# Add "Who Referred Them?" Field for Member Referral Lead Source

## Problem
When a booking is created with a "Member Referral" lead source, there is no field to capture **who** the referring member is. The `referred_by_member_name` column already exists on `intros_booked` but is only populated from the ShiftRecap form. The two main booking sheets (BookIntroSheet and WalkInIntroSheet) do not prompt for it.

## Scope
The "Member Referral" lead source specifically needs a "Who referred them?" text input. This is distinct from the existing "Did they bring a friend?" prompt which handles friend-type referral sources. The `isReferralSource()` helper already matches "Member Referral" — the referrer name field should appear alongside (or above) the friend prompt for this specific source.

## Changes

### 1. `src/components/dashboard/BookIntroSheet.tsx`
- Add state: `const [referredBy, setReferredBy] = useState('')`
- Reset it in `reset()`
- Reset it in `handleLeadSourceChange()`
- When `leadSource === 'Member Referral'`, render a text input: "Who referred them?" above the friend prompt
- In `handleSave`, pass `referred_by_member_name: referredBy.trim() || null` to the `intros_booked` insert

### 2. `src/components/dashboard/WalkInIntroSheet.tsx`
- Same pattern: add `referredBy` state, render the input when `leadSource === 'Member Referral'`, save to `referred_by_member_name`

### No database changes needed
The `referred_by_member_name` column already exists on `intros_booked`.

## Files Changed

| File | Change |
|------|--------|
| `src/components/dashboard/BookIntroSheet.tsx` | Add referredBy state + input for "Member Referral" source, save to `referred_by_member_name` |
| `src/components/dashboard/WalkInIntroSheet.tsx` | Same pattern |

