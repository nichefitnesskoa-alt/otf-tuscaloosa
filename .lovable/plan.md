

# Fix: "Resend Questionnaire" Not Populating Booking Form

## The Problem

When you select a client and choose "Resend Questionnaire," the form briefly shows the client's info (name, date, etc.) but then immediately reverts back to what was typed (e.g., "ry"). The booking data doesn't stick.

## Root Cause

The `updateIntroBooking` function in `ShiftRecap.tsx` uses stale state due to a JavaScript closure issue:

```text
Current (broken):
  setIntrosBooked(introsBooked.map(...))
                  ^^^^^^^^^^^^
                  This is a snapshot from when the function was created,
                  not the latest state
```

When "Resend Questionnaire" is chosen, `onUpdate` is called **twice**:
1. First call: sets memberName, introDate, introTime, leadSource, notes
2. Second call (after async questionnaire lookup): sets questionnaireId, questionnaireStatus

The second call still sees the **old** state (before the first update), so it overwrites all the fields back to their original values (e.g., memberName goes back to "ry").

## The Fix

### File: `src/pages/ShiftRecap.tsx`

Change `updateIntroBooking` to use a **functional state update**, which always receives the latest state:

```text
Before:
  setIntrosBooked(introsBooked.map((intro, i) =>
    i === index ? { ...intro, ...updates } : intro
  ));

After:
  setIntrosBooked(prev => prev.map((intro, i) =>
    i === index ? { ...intro, ...updates } : intro
  ));
```

This one-line change ensures both updates are applied correctly, even when called in quick succession or after async operations.

No other files or database changes needed.

