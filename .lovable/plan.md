

# Fix: Shift Recap "Booked" Count Should Use Created Date, Not Class Date

## Problem Found

The shift recap summary query filters bookings by `class_date = today`. This means if an SA books someone today for a future class date (e.g., Sophie booked Anna Sprayberry today for March 3rd), it shows **0 booked** in the pre-submission summary and GroupMe post.

Sophie has exactly **1 booking created today** (Anna Sprayberry). The `booked_by` field correctly says "Sophie" — there is no name mismatch. The issue is purely the date filter.

## Root Cause

In `CloseOutShift.tsx` lines 91-103, both queries use:
```
.eq('class_date', today)
```

This should instead filter by `created_at` to count bookings the SA **made during their shift**, regardless of when the class is scheduled.

## Fix

### 1. Update `CloseOutShift.tsx` — Shift Recap Summary

Change both booking queries from filtering by `class_date = today` to filtering by `created_at >= todayStart` and `created_at < tomorrowStart`. This counts bookings **created** during the shift, which is the metric SAs care about.

Both the `sa_working_shift` query and the `booked_by` query get the same date filter update.

### 2. Update `TodayActivityLog.tsx` — Today's Activity

Apply the same fix so the activity log shows bookings created today, not bookings with a class date of today. This keeps numbers consistent across surfaces.

### 3. Update GroupMe Post Logic

The GroupMe post reads from the same `summary.booked` value, so fixing the query in `CloseOutShift.tsx` automatically fixes the GroupMe count — no separate change needed.

### 4. Consistency Check

Verify that the `ShiftHandoffSummary` component (if it counts bookings) also uses `created_at` for the same metric. The "booked" count should mean "how many bookings did you create today" everywhere.

## Technical Details

- File: `src/components/dashboard/CloseOutShift.tsx` (lines 91-103)
  - Replace `.eq('class_date', today)` with `.gte('created_at', todayStart).lt('created_at', tomorrowStart)` on both booking queries
  - Add `const tomorrowStart = today + 'T00:00:00'` calculation using date math

- File: `src/components/dashboard/TodayActivityLog.tsx`
  - Same date filter fix for the bookings query

## What This Does NOT Change

- Intros **run** today still filter by `run_date = today` (correct — you ran the intro today)
- Sales still use `buy_date` logic (correct — revenue attribution)
- VIP/COMP exclusion remains unchanged
- No schema or database changes needed

