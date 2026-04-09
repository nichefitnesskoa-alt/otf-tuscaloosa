# Fix Follow-Up Outcome Logging + Add Friend Referral on Sale  
  
The outcome drawer referral prompt needs to have a space in the WIG tab as a lead measure for SAs. We need to know how many people we've done that with vs total INTRO sales, not outside sales  


## Problems Identified

1. **Outcome drawer doesn't open for follow-up cards**: When clicking "Log Outcome" on a follow-up card, the event fires `myday:open-outcome` with a booking ID. But MyDayPage looks up that booking from `introsBooked` (which only has the current week's data). Past bookings from follow-up items aren't in that array, so `outcomeBooking` is `null` and the drawer renders empty.
2. **Follow-up category not editable**: The follow-up type is auto-determined by the outcome result. The user wants this to be a selectable/fillable field.
3. **Friend referral question on sale**: When a sale outcome is selected, the drawer should ask "Do they have any friends who want to take their first free class?" before closing.

## Changes

### 1. Fix outcome drawer for follow-up bookings (MyDayPage.tsx)

When `outcomeBookingId` is set but not found in the loaded `introsBooked`, fetch that booking directly from the database. Add a `useEffect` that fetches the booking by ID from `intros_booked` when the local lookup fails, storing it in a separate `fallbackBooking` state. Use `outcomeBooking || fallbackBooking` when rendering the OutcomeDrawer.

### 2. Add follow-up category selector to OutcomeDrawer (OutcomeDrawer.tsx)

After the main outcome is selected, if the outcome maps to a follow-up type (Follow-up needed, No-show, Planning to Reschedule, Planning to Book 2nd Intro), show a dropdown to let the user override the follow-up category. Options:

- No Show (1st Intro)
- No Show (2nd Intro)
- Planning to Reschedule
- Didn't Buy (1st Intro - Try to Reschedule 2nd)
- Didn't Buy (2nd Intro - Final Reach Out)

This will be passed to `applyIntroOutcomeUpdate` and used when generating follow-up queue entries.

### 3. Add friend referral prompt on sale (OutcomeDrawer.tsx)

When outcome is a sale and save succeeds, instead of immediately calling `onSaved()`, show an inline section asking: "Do they have any friends who want to join them or take their first free class?" with Yes/No buttons. If Yes, show friend name + phone fields, save a referral + booking, then close. If No, close immediately. Reuse existing `FriendReferralDialog` logic for the save.

### 4. Wire follow-up category through the outcome pipeline (applyIntroOutcomeUpdate.ts)

Add optional `followUpCategory` param to `OutcomeUpdateParams`. When generating follow-up queue entries, use this category to set the correct `person_type` value instead of auto-detecting from the result.

## What does NOT change

- Follow-up data query logic (useFollowUpData)
- Follow-up card layout
- Pipeline, WIG, or any other page
- Database schema (no migrations needed)