

# Add "Who's Coaching" Field to Intro Booking Entry

## What Changes

When booking an intro, staff will now be able to select which coach is running the session. Currently the coach is always saved as "TBD" and only gets filled in later when the intro is actually run.

Adding a coach dropdown to the booking form lets staff assign the coach upfront when they know who it will be, while still defaulting to "TBD" if unknown.

## Technical Details

### 1. Update `IntroBookingData` interface (`src/components/IntroBookingEntry.tsx`)
- Add `coachName: string` field to the interface (default `'TBD'`)

### 2. Add coach selector UI (`src/components/IntroBookingEntry.tsx`)
- Add a `<Select>` dropdown labeled "Who's Coaching" between the Lead Source and Notes fields
- Options: all coaches from `COACHES` constant, plus a "TBD" option for when unknown
- Import `COACHES` from `@/types`

### 3. Update booking creation default (`src/pages/ShiftRecap.tsx`)
- When creating a new blank booking entry, set `coachName: 'TBD'`
- When inserting into `intros_booked`, use `booking.coachName` instead of the hardcoded `'TBD'`

### 4. No database changes needed
- The `intros_booked` table already has a `coach_name` column -- we're just populating it from the form instead of hardcoding "TBD"

