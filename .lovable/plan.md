

## Problem

Friend bookings created via the "Bring a Friend" feature set `originating_booking_id`, which the app uses everywhere as the signal for "2nd intro." This causes friends to be:
- Excluded from Booker Stats counts (`useDashboardMetrics.ts` line 155-159)
- Excluded from Lead Measures Q% and Prep% (`useLeadMeasures.ts` line 65)
- Excluded from Meeting Agenda counts (`useMeetingAgenda.ts` line 299)
- Excluded from Recaps page first-intro filters (`Recaps.tsx` line 66)
- Potentially flagged as "2nd intro" in MyDay cards

Database audit shows **1 record** currently has both `originating_booking_id` AND `referred_by_member_name` (the friend signal). There are also records in `BookIntroSheet` inline friend flow that set `originating_booking_id` without `referred_by_member_name`.

## Fix Plan

### 1. Stop setting `originating_booking_id` on friend bookings (source fix)

**`FriendReferralDialog.tsx`** line 93 — remove `originating_booking_id: originalBooking.id`. The `paired_booking_id` and `referred_by_member_name` fields already link the friend correctly.

**`BookIntroSheet.tsx`** line 157 — remove `originating_booking_id: inserted.id` from the inline friend insert. Add `referred_by_member_name: memberName` so this path also marks friends properly.

### 2. Fix the DB trigger that skips questionnaire creation for friends

The `auto_create_questionnaire()` trigger (line: `IF NEW.originating_booking_id IS NOT NULL THEN RETURN NEW`) skips questionnaire creation for any booking with `originating_booking_id`. After we stop setting it on friends, this self-corrects. No trigger change needed.

### 3. Update all stat filters to distinguish friends from true 2nd intros

Add a shared helper in `src/lib/introHelpers.ts`:

```typescript
export function isTrueSecondIntro(booking: { 
  originating_booking_id?: string | null; 
  referred_by_member_name?: string | null;
  paired_booking_id?: string | null;
}): boolean {
  if (!booking.originating_booking_id) return false;
  // Friend bookings have referred_by_member_name set — not 2nd intros
  if (booking.referred_by_member_name) return false;
  return true;
}
```

Update these files to use the helper instead of raw `originating_booking_id` checks:
- `useDashboardMetrics.ts` — `firstIntroBookings` filter
- `useLeadMeasures.ts` — `allBookings` filter
- `useMeetingAgenda.ts` — booking count filter
- `Recaps.tsx` — first intro filter
- `ConversionFunnel.tsx` — booking classification
- `useUpcomingIntrosData.ts` — 2nd intro detection step 1 (already partially correct but needs the referred_by guard)

### 4. Data migration — clear `originating_booking_id` on existing friend bookings

SQL migration:
```sql
UPDATE intros_booked
SET originating_booking_id = NULL
WHERE originating_booking_id IS NOT NULL
  AND (referred_by_member_name IS NOT NULL OR paired_booking_id IS NOT NULL);
```

This fixes the 1 existing record (and any from BookIntroSheet's inline flow that used `paired_booking_id` without `referred_by_member_name`).

### 5. Downstream effects that auto-correct

Once friend bookings no longer have `originating_booking_id`:
- Friends count in Booker Stats, Shift Recap, Lead Measures, Meeting Agenda
- Friends get questionnaires created by the DB trigger
- Friends show as 1st intros in MyDay (no blue "2nd Intro" banner)
- Pipeline metrics include friends in totals

