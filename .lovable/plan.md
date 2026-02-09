

# Fix Pay Period Date Inconsistency

## Problem

The "Last Pay Period" in the Admin Overview tab is showing the wrong dates. It should show **January 26 - February 8, 2026** but is showing different dates.

## Root Cause

There's a **timezone inconsistency** between how the pay period anchor date is created in two different files:

| File | Code | Issue |
|------|------|-------|
| `src/lib/pay-period.ts` | `new Date(2026, 0, 26)` | Creates date in **local time** - correct |
| `src/components/PayPeriodCommission.tsx` | `new Date('2026-01-26')` | Creates date in **UTC** - can shift by a day |

When you use `new Date('2026-01-26')` (ISO string without time), JavaScript interprets it as midnight UTC. For users in US timezones (UTC-5 to UTC-8), this becomes January 25th at 7pm or earlier, causing all pay periods to shift by one day.

## Solution

Update `PayPeriodCommission.tsx` to use the same date constructor format as `pay-period.ts`:

```typescript
// Before (line 12)
const PAY_PERIOD_ANCHOR = new Date('2026-01-26');

// After
const PAY_PERIOD_ANCHOR = new Date(2026, 0, 26); // January 26, 2026
```

This ensures consistent local-time interpretation across the application.

## Technical Details

**Why this matters:**
- `new Date('2026-01-26')` → Parsed as UTC midnight → Jan 25, 7pm EST
- `new Date(2026, 0, 26)` → Parsed as local midnight → Jan 26, 12am local

The second approach matches user expectations for pay period boundaries.

## Files to Modify

| File | Change |
|------|--------|
| `src/components/PayPeriodCommission.tsx` | Update line 12 to use `new Date(2026, 0, 26)` |

## Testing

After the fix, verify:
- Current pay period shows: **Feb 9 - Feb 22, 2026**
- Last pay period shows: **Jan 26 - Feb 8, 2026**
- The Pay Period Commission dropdown in Admin shows correct date ranges

