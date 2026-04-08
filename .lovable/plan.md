

# Add "Celebration Rate" Metric to Milestones Summary

## Problem
You can see how many celebrations were logged, but not how many were actually celebrated vs. how many should have been. You need a ratio: celebrated / total logged.

## Changes

### File: `src/components/dashboard/MilestonesDeploySection.tsx`

1. **Update `WeekSummary` interface** — add `actuallyCelebrated: number`

2. **Update `loadData` summary calculation** — count milestones where `actually_celebrated === true`:
   ```
   actuallyCelebrated: mils.filter(m => m.actually_celebrated).length
   ```

3. **Update `summaryCards` array** — replace or add a card showing the celebration rate:
   - Change the existing "Celebrations" card to show `actuallyCelebrated / celebrations` format
   - Display as: value = `"X / Y"` where X = actually celebrated, Y = total logged
   - Label = `"Celebrated"` 
   - Color the number: green if X === Y, amber if X > 0 but < Y, red if X === 0 and Y > 0

This gives you an at-a-glance view: "We had 9 milestones to celebrate and we actually celebrated 7 of them."

## What does NOT change
- Database schema (already has `actually_celebrated` column)
- Log/edit dialog behavior
- Deploy tab, pipeline logic, or any other page

