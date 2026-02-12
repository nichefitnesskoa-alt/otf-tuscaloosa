

# Fix: Always Land on My Day After Login

## Root Cause
The Login page (`src/pages/Login.tsx`, line 18) navigates to `/shift-recap` after login instead of `/my-day`. This is a leftover from before My Day was added as the homepage.

## Fix
**File: `src/pages/Login.tsx`** (line 18)
- Change `navigate('/shift-recap')` to `navigate('/my-day')`

That single line change ensures every login lands on the My Day screen, regardless of which user logs in.

