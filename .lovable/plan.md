
# Add Status-Based Tabs to Client Journey View

## Overview
Add a tabbed interface to organize clients by their intro status, making it easy to see who hasn't shown up yet, who no-showed, who is a "missed guest" (showed but didn't buy), and who has a 2nd intro scheduled.

## Tab Structure

| Tab | Description | Filter Logic |
|-----|-------------|--------------|
| **All** | All clients (current view) | No filter |
| **Upcoming** | Intros scheduled for future dates | `class_date > today` OR (`class_date = today` AND `intro_time > now`) |
| **Today** | Intros scheduled for today | `class_date = today` |
| **Completed** | Intros that have been run | Has a run record (not just a booking) |
| **No-shows** | Bookings past their scheduled time with no run logged | Booking date/time is past AND no linked run exists |
| **Missed Guests** | Showed up but didn't buy (includes those awaiting 2nd intro) | Has a run with result = 'Follow-up needed' OR 'Booked 2nd intro' |
| **2nd Intros** | Clients scheduled for a 2nd intro | Booking has `originating_booking_id` set OR run result = 'Booked 2nd intro' |

## Implementation Details

### 1. Add Tab State and UI
- Import the Tabs components from existing UI library
- Add state for `activeTab` with default value "all"
- Wrap the client list in a Tabs component with 7 tab triggers

### 2. Create Tab Filtering Logic
Create a `getFilteredByTab` function that applies different filters based on the active tab:

```text
function getFilteredByTab(journeys, activeTab, currentDateTime):
  switch activeTab:
    case "all": return journeys
    case "upcoming": filter where latest booking is in the future
    case "today": filter where latest booking is today
    case "completed": filter where runs.length > 0
    case "no_show": filter where booking is past AND no run exists
    case "missed_guest": filter where run result is "Follow-up needed" or "Booked 2nd intro"
    case "second_intro": filter where originating_booking_id exists OR result = "Booked 2nd intro"
```

### 3. Auto-Detection Logic for No-Shows
The key feature: automatically detect no-shows by comparing:
- Booking `class_date` + `intro_time` against current date/time
- If the scheduled time has passed AND there's no linked run record, show in "No-shows" tab

### 4. Update Summary Stats
Show counts for each tab in the summary grid or as badge counts on the tab triggers.

## File Changes

**src/components/admin/ClientJourneyPanel.tsx**:
1. Add import for Tabs components
2. Add `activeTab` state
3. Create `getTabCounts` function to calculate counts per tab
4. Create `filterJourneysByTab` function with the filtering logic
5. Update the `filteredJourneys` memo to apply tab filtering after search/inconsistency filters
6. Wrap the client list section in a Tabs component with TabsList and TabsContent

## Technical Considerations

### Time Comparison
- Use current date/time to determine if a booking is "past" its scheduled slot
- Account for bookings without `intro_time` (treat as end of day)
- Handle timezone considerations using local time

### 2nd Intro Detection
Since `originating_booking_id` isn't being populated in the current data, also check:
- Run result = "Booked 2nd intro" 
- Multiple bookings for the same member

### Edge Cases
- Clients with multiple bookings show in the tab matching their most recent/relevant booking
- A client could appear in both "Missed Guest" and "2nd Intros" if they have a scheduled 2nd intro after an initial intro that didn't convert

## Expected UI

```text
+------------------------------------------------------------------+
| Client Journey View                    [Add Booking] [Fix] [↻]    |
| Unified view of client bookings...                               |
+------------------------------------------------------------------+
| [Search...]                                    [⚠ Issues (0)]    |
+------------------------------------------------------------------+
| All | Upcoming | Today | Completed | No-shows | Missed | 2nd     |
| (50)   (8)       (3)     (25)        (4)       (12)     (6)      |
+------------------------------------------------------------------+
| [Summary Stats Grid]                                              |
+------------------------------------------------------------------+
| [Filtered Client List based on active tab]                       |
+------------------------------------------------------------------+
```

The tab badges will show the count for each category, making it easy to see at a glance how many clients fall into each bucket.
