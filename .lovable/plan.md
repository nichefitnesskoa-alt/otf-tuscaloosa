
# Fix No-Show Detection Using Correct Local Date/Time

## Problem

Bookings for future dates (like Mary El Neal on Feb 9th) are incorrectly showing in the No-shows tab. This is happening because the `isBookingPast`, `isBookingToday`, and `isBookingUpcoming` helper functions in `ClientJourneyPanel.tsx` are mixing UTC and local time calculations.

The root cause:
```typescript
// Line 389 - converts to UTC then extracts date (WRONG)
const today = now.toISOString().split('T')[0]; // Returns UTC date!

// Line 400 - uses local time (CORRECT)
const currentTime = now.toTimeString().slice(0, 5); // Returns local time
```

When a user is in CST timezone at 10pm on Feb 8th:
- `toISOString().split('T')[0]` returns `2026-02-09` (UTC date = tomorrow)
- `toTimeString().slice(0, 5)` returns `22:00` (local time)

This mismatch causes incorrect date comparisons.

## Solution

Update all three helper functions to use **local date formatting** instead of UTC conversion:

```typescript
// Instead of:
const today = now.toISOString().split('T')[0]; // UTC!

// Use:
const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
// Or use a helper function for cleaner code
```

---

## Technical Changes

### File: `src/components/admin/ClientJourneyPanel.tsx`

**1. Add local date formatting helper (around line 386)**

Add a small utility function to get today's date in local `YYYY-MM-DD` format:

```typescript
// Helper to get current local date as YYYY-MM-DD string
const getLocalDateString = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};
```

**2. Update `isBookingPast` function (lines 387-402)**

```typescript
// Current (broken):
const today = now.toISOString().split('T')[0];

// Fixed:
const today = getLocalDateString(now);
```

**3. Update `isBookingToday` function (lines 404-408)**

```typescript
// Current (broken):
const today = new Date().toISOString().split('T')[0];

// Fixed:
const today = getLocalDateString(new Date());
```

**4. Update `isBookingUpcoming` function (lines 410-423)**

```typescript
// Current (broken):
const today = now.toISOString().split('T')[0];

// Fixed:
const today = getLocalDateString(now);
```

---

## Before vs After

| Scenario | Before (Bug) | After (Fixed) |
|----------|--------------|---------------|
| User in CST at 10pm Feb 8th | `today = '2026-02-09'` (UTC) | `today = '2026-02-08'` (local) |
| Mary El Neal booked for Feb 9th | Shows in No-shows (wrong!) | Shows in Upcoming (correct) |
| Sydney Hawkinson booked for Feb 9th | Shows in No-shows (wrong!) | Shows in Upcoming (correct) |

---

## Summary

| Change | Location |
|--------|----------|
| Add `getLocalDateString` helper | After line 385 |
| Fix `isBookingPast` | Line 389 |
| Fix `isBookingToday` | Line 406 |
| Fix `isBookingUpcoming` | Line 413 |

This ensures that No-shows only includes bookings where the local date AND time have actually passed, and future bookings correctly appear in Upcoming.
