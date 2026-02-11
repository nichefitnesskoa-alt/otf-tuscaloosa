

# Exclude "Run-first entry" from Top Performers

## Problem

When staff manually enter an intro run without a prior booking, the system auto-creates a booking with `booked_by = 'Run-first entry'`. There are 14 such records. The `EXCLUDED_NAMES` list in `useDashboardMetrics.ts` does not include this value, so these entries inflate the Top Bookers and Best Show Rate leaderboards in the Top Performers section.

The `PayPeriodCommission` component already excludes this value -- the dashboard metrics hook just needs to match.

## Fix

**File:** `src/hooks/useDashboardMetrics.ts` (line 110)

Add `'Run-first entry'` to the `EXCLUDED_NAMES` array:

```
Before:
const EXCLUDED_NAMES = ['TBD', 'Unknown', '', 'N/A', 'Self Booked', 'Self-Booked', 'self booked', 'Self-booked'];

After:
const EXCLUDED_NAMES = ['TBD', 'Unknown', '', 'N/A', 'Self Booked', 'Self-Booked', 'self booked', 'Self-booked', 'Run-first entry'];
```

This one-line change filters "Run-first entry" out of:
- **Top Bookers** leaderboard (bookerCounts uses EXCLUDED_NAMES at line 309)
- **Best Show Rate** leaderboard (derived from bookerCounts)
- **SA name collection** (line 159)

No other files need changes.
