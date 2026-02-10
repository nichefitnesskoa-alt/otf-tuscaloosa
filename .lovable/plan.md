

# Show All Lead Sources in Distribution Summary

## Problem

The Lead Source Analytics chart currently limits what's displayed:
- **Pie chart**: Only shows the top 6 sources (line 41: `.slice(0, 6)`)
- **Summary list below pie chart**: Only shows the top 4 sources (line 115: `.slice(0, 4)`)

This means sources like Member Referral, Instagram DMs (Friend), etc. are being cut off if they're not in the top 4-6 by volume.

## Solution

Remove the caps so ALL lead sources with bookings are shown in both the pie chart and the summary list below it.

## Technical Changes

### File: `src/components/dashboard/LeadSourceChart.tsx`

1. **Pie chart data** (line 41): Remove `.slice(0, 6)` so all sources appear in the chart
2. **Summary list** (line 115): Remove `.slice(0, 4)` so all sources are listed below the chart with their booked/sold counts
3. **Add more colors** to the COLORS array so sources beyond 8 still get distinct colors
4. **Increase pie chart height** slightly (from 200 to 240) to accommodate more labels -- or remove inline labels and rely on the full list below the chart for readability

Since many sources can make pie labels overlap, the plan is to:
- Remove the inline `label` prop from the Pie chart (the labels like "Instagram DMs (45%)" that render on the chart itself get crowded)
- Keep the tooltip on hover for details
- Show the **complete list** below the chart with color dots, source names, booked count, and sold count

This gives you a clean pie chart with every source visible, plus a full readable list underneath.

