

## Plan: Remove duplicate header from Coach View for Admin users

The Coach View page has its own built-in sticky header with greeting, user info, and logout button. This was added for Coach-role users who have no app-level navigation. Admin users already have the global `Header` component via `AppLayout`, so they see a double bar.

**Fix in `src/pages/CoachView.tsx`:**
- Wrap the entire sticky header block (lines 168-191) in a condition: only render it when `user?.role === 'Coach'`. Admin users skip it entirely since they already have the app header with user info and logout.

One small, targeted change. No other files affected.

