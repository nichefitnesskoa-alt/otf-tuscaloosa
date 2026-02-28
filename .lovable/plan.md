## Plan: Remove Progress Bar from Sticky Header

The user wants to keep the Activity Tracker / contact logs but remove the progress bar in the sticky floating header (the "11/21 actions · 52%" section directly under the greeting and dark mode toggle).

### Change

**File:** `src/features/myDay/MyDayPage.tsx`

Remove lines 287–304 — the entire `{totalActions > 0 && (...)}` block that renders the progress bar with completed/total actions count and percentage. This is the section immediately below the greeting row in the sticky header.

The `completedActions`, `totalActions`, and `progressPct` computed values (lines 224–230) can also be removed since they'll be unused, along with related state that only feeds them if no longer referenced elsewhere.

The sticky header will then contain only the greeting + date + dark mode toggle — nothing else.

One file, one deletion. No other changes.  
  
  
  
Bring back my Shift dropdown, Calls, texts, DMs made log