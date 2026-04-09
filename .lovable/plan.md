

# Exclude "Planning to Reschedule" from Day-Tab Intro Cards

## Problem
When navigating via day tabs (Mon–Sun), the query uses a minimal exclusion list (`DELETED_SOFT` only), so bookings with `PLANNING_RESCHEDULE` status still appear as active intro cards.

## Fix

**File: `src/features/myDay/useUpcomingIntrosData.ts`** (~line 82)

Change the `isWeekFullNav` exclusion from:
```
'("DELETED_SOFT")'
```
to:
```
'("DELETED_SOFT","CANCELLED","PLANNING_RESCHEDULE")'
```

This ensures "Planning to Reschedule" bookings are hidden from all day-tab views, consistent with the today/rest-of-week views. They remain visible only in the Follow-Up tab.

## What does NOT change
- Follow-Up tab (reschedule items still appear there)
- Needs Outcome backlog filtering
- Any other page or component

