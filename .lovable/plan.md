

# Comprehensive Metrics Fix: Closing Rates, Coach Performance, and Sales Attribution

## Executive Summary

After a deep analysis of the metrics system, I've identified **critical bugs** that are causing Grace and Kailey's sales today to NOT be counted in their closing rates, and coach performance metrics to be incorrect.

## Root Cause Analysis

### Bug 1: Follow-up Conversions Are Ignored (HIGH SEVERITY)

**The Problem:**
The metrics system only counts the FIRST run per booking. When a client:
1. Comes in for an intro (result: "Follow-up needed")
2. Returns later and purchases a membership (result: "Premier w/o OTBeat")

Only the first run is counted, so the **sale is completely ignored** in closing rate calculations.

**Evidence from Today's Data:**
| Member | First Run (Counted) | Second Run (IGNORED) | Intro Owner |
|--------|---------------------|----------------------|-------------|
| Zoe Hall | Follow-up needed (Feb 4) | Premier w/o OTBeat $15 (Feb 6) | Grace |
| Adeline Harper | Follow-up needed (Feb 4) | Premier w/o OTBeat $15 (Feb 6) | Grace |
| Anna Livingston | Follow-up needed (Feb 5) | Premier w/o OTBeat $15 (Feb 6) | Kailey |

**Current Wrong Calculations:**
- Grace: 7 intros / 0 sales = 0% (WRONG - should be 2 sales = 29%)
- Kailey: 4 intros / 1 sale = 25% (WRONG - should be 2 sales = 50%)

### Bug 2: Coach Performance Excludes Self-Booked Clients

Coach Natalya coached Zoe Hall and Adeline Harper (both self-booked), but these are excluded from coach metrics. The logic incorrectly filters out the booking entirely instead of just excluding it from booker credit.

### Bug 3: Today's Race Uses Wrong Sale Detection

The "Today's Race" component checks `commission_amount > 0` instead of checking the result string for membership keywords.

## Technical Solution

### Fix 1: Capture Final Outcome, Not First Run

Instead of using the first run's result, we need to track whether **any run** for a booking resulted in a sale. The correct logic:

```text
For each unique booking:
1. Count as "intro run" if ANY run exists (not no-show)
2. Count as "sale" if ANY run has membership result
3. Use the commission from the run with the sale result
```

**Files to modify:**
- `src/hooks/useDashboardMetrics.ts` (lines 204-238)

### Fix 2: Coach Performance - Include All Coached Intros

Remove the self-booked exclusion from CoachPerformance. Self-booked clients still get coached, and that matters for coach metrics.

**Files to modify:**
- `src/components/dashboard/CoachPerformance.tsx` (lines 63-65)

### Fix 3: Today's Race - Use Result String

Change the sales detection to use the same `isMembershipSale()` helper.

**Files to modify:**
- `src/hooks/useDashboardMetrics.ts` (lines 391-398)

## Implementation Details

### Step 1: Update useDashboardMetrics.ts - Per-SA Metrics

**Current (broken) logic:**
```javascript
// Only takes FIRST run, ignores subsequent conversions
const firstValidRun = sortedRuns[0];
if (isMembershipSale(firstValidRun.result)) {
  salesCount++;
}
```

**Fixed logic:**
```javascript
// Check if ANY run has a membership sale result
const anyRunWithSale = runs.find(r => isMembershipSale(r.result));
if (anyRunWithSale) {
  salesCount++;
  commission += anyRunWithSale.commission_amount || 0;
}
// introsRunCount still counts unique bookings (first valid run determines "ran")
```

### Step 2: Update CoachPerformance.tsx

**Current (broken) logic:**
```javascript
const isSelfBooked = EXCLUDED_BOOKERS.some(e => 
  bookedBy.toLowerCase() === e.toLowerCase());
return !isExcludedStatus && !isIgnored && !isSelfBooked;
```

**Fixed logic:**
```javascript
// Don't exclude self-booked - coaches still coach these clients
return !isExcludedStatus && !isIgnored;
```

Also update the sales detection to find ANY sale run:
```javascript
const saleRun = runs.find(r => isMembershipSale(r.result));
if (saleRun) {
  existing.sales++;
  existing.commission += saleRun.commission_amount || 0;
}
```

### Step 3: Update Today's Race

**Current (broken) logic:**
```javascript
if (run.commission_amount && run.commission_amount > 0) {
  existing.sales++;
}
```

**Fixed logic:**
```javascript
if (isMembershipSale(run.result)) {
  existing.sales++;
}
```

## Expected Results After Fix

**Grace's Metrics (Pay Period):**
- Intros Run: 7 (unique bookings with a showed run)
- Sales: 2 (Zoe Hall + Adeline Harper)
- Closing Rate: 29%
- Commission: $30

**Kailey's Metrics (Pay Period):**
- Intros Run: 4 (unique bookings with a showed run)
- Sales: 2 (Lauryn Holzkamp + Anna Livingston)
- Closing Rate: 50%
- Commission: $30

**Coach Natalya's Metrics:**
- Intros Coached: 3 (including self-booked)
- Sales: 2 (Zoe Hall + Adeline Harper)
- Closing Rate: 67%

## Files to Modify

1. **src/hooks/useDashboardMetrics.ts**
   - Fix Per-SA metrics to use any-run-with-sale logic
   - Fix Today's Race sale detection
   - Ensure commission is summed correctly from sale runs

2. **src/components/dashboard/CoachPerformance.tsx**
   - Remove self-booked exclusion for coach stats
   - Use any-run-with-sale logic for coach closing rate

## Testing Checklist

After implementation, verify:
- [ ] Grace shows 2 sales and ~29% closing rate
- [ ] Kailey shows 2 sales and ~50% closing rate  
- [ ] Coach Natalya shows 2 sales with 67% closing rate
- [ ] Today's race correctly shows today's sales
- [ ] Studio scoreboard totals match sum of per-SA metrics
- [ ] Commission totals are accurate

