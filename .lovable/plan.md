

# Dashboard Restructuring Plan

## Summary
This plan restructures the Dashboard to create a clear separation between personal (My Stats) and studio-wide metrics. The "My Stats" tab will focus purely on individual performance, while the "Studio" tab will contain all studio-wide analytics. Coach stats will be moved to Admin only.

---

## Changes Overview

### My Stats Tab - Remove These Components
- Achievements card (gamification)
- Today's Race widget
- Weekly Challenges widget
- Individual Activity table (will only show personal activity on this tab - keeping but it's already personal)

### Studio Tab - Changes
1. **Remove from Studio tab:**
   - Coach Performance section (move to Admin only)
   - Individual Activity table
   - Commission from StudioScoreboard

2. **Limit Top Performers:**
   - All leaderboard categories: max 3 entries (already the case, but ensure no expansion)

3. **Per-SA Performance table:**
   - Add sorting capability by columns (clicking headers to sort)
   - Remove commission column

4. **Lead Source Analytics:**
   - Add "sold" count to show how many leads from each source purchased memberships

---

## Technical Implementation

### 1. Dashboard.tsx - My Stats Tab Cleanup
**Remove from personal view:**
- Achievement card and related code (lines 258-266)
- TodaysRace component (lines 268-272)
- WeeklyChallenges component (lines 274-278)
- Remove unused imports: TodaysRace, WeeklyChallenges, AchievementGrid, Achievement
- Remove unused useMemo computations for achievements and weeklyChallenges

### 2. Dashboard.tsx - Studio Tab Cleanup
**Remove:**
- CoachPerformance component (lines 305-310)
- IndividualActivityTable component (lines 345-346)
- Remove CoachPerformance import

### 3. StudioScoreboard.tsx - Remove Commission
**Changes:**
- Remove the Commission metric from the main metrics row
- Change grid from 4 columns to 3 columns
- Remove totalCommission prop and related display

### 4. PerSATable.tsx - Sortable Columns & Remove Commission
**Changes:**
- Add sorting state to track current sort column and direction
- Make table headers clickable with sort indicators
- Remove the Commission column entirely
- Implement sort logic for: SA name, Run, Sales, Close%, Goal, Rel., Friend

### 5. LeadSourceChart.tsx - Show Sales Count
**Changes:**
- Update the Distribution pie chart to show an option for "Sales" in addition to "Booked"
- Add a "Sales" tab or integrate sales count into the existing views
- Show "X booked, Y sold" in tooltips

### 6. Leaderboards.tsx - Remove Top Commission Card
**Changes:**
- Remove the "Top Commission" leaderboard card
- Update grid from 2x2 to show remaining 3 cards in a clean layout

### 7. Admin.tsx - Add Coach Performance
**Changes:**
- Import CoachPerformance component
- Add CoachPerformance to the Admin "overview" or "data" tab
- Pass required props (introsBooked, introsRun, dateRange)

---

## File Changes Summary

| File | Action |
|------|--------|
| `src/pages/Dashboard.tsx` | Remove Achievements, TodaysRace, WeeklyChallenges from My Stats; Remove CoachPerformance, IndividualActivity from Studio |
| `src/components/dashboard/StudioScoreboard.tsx` | Remove Commission metric, change to 3-column grid |
| `src/components/dashboard/PerSATable.tsx` | Add sortable columns, remove Commission column |
| `src/components/dashboard/LeadSourceChart.tsx` | Add sold count display |
| `src/components/dashboard/Leaderboards.tsx` | Remove Top Commission card, adjust layout |
| `src/pages/Admin.tsx` | Add CoachPerformance component |

---

## Detailed Component Changes

### PerSATable - Sortable Implementation
```text
+------------------------------------------------------------------+
| Per-SA Performance                                                |
+------------------------------------------------------------------+
| SA (sort) | Run (sort) | Sales (sort) | Close% | Goal | Rel | Friend |
+------------------------------------------------------------------+
| Nathan    | 12         | 4            | 33%    | 85%  | 90% | 75%    |
| James     | 10         | 5            | 50%    | 92%  | 88% | 80%    |
+------------------------------------------------------------------+
```

Clicking any column header will:
- Sort ascending on first click
- Sort descending on second click
- Show arrow indicator for sort direction

### Lead Source Analytics Enhancement
The existing chart already tracks `sold` in the data. The change will:
- Add sold count to tooltips in Distribution view
- Show "X booked / Y sold" format
- Potentially add a third tab showing "Sales by Source" pie chart

### Leaderboards New Layout
With Top Commission removed, the remaining 3 cards will display in a responsive grid:
- Top Bookers
- Best Closing %
- Best Show Rate

---

## What Stays the Same
- Personal Scoreboard (commission stays here - this is individual)
- Progress Ring with today's goal
- Personal Activity table (shows user's own outreach activity)
- All Studio tab components except those explicitly removed
- Pipeline Funnel, Client Pipeline, Members Who Bought in Studio tab

