

# Leads Pacing Indicator + Celebration "Actually Celebrated" Field

## Change 1 — Leads Pacing Indicator on Scorecard

Add a pacing subtitle below the Leads card that shows whether the studio is on pace to hit the target by end of month.

**Logic:**
- Calculate days elapsed in month (today - 1st of month) and total days in month
- Expected pace = `(target * daysElapsed / totalDays)`
- Compare actual leads vs expected pace
- Display: "On pace for ~{projected}" where projected = `(actual / daysElapsed) * totalDays`
- Color: green if projected >= target, amber if projected >= 80% of target, red if below

This shows beneath the target line on the Leads scorecard card. Only visible when the date preset is "This Month" or "This Quarter" (pacing makes no sense for completed past ranges).

**File:** `src/pages/Wig.tsx` — add pacing calculation in the Leads card render block (around line 500-540).

## Change 2 — Add "Actually Celebrated?" Toggle to Log Celebration Dialog

Add a new boolean field `actually_celebrated` to the milestones table and the celebration form.

**Database migration:**
```sql
ALTER TABLE public.milestones
  ADD COLUMN actually_celebrated boolean NOT NULL DEFAULT false;
```

**UI changes in `src/components/dashboard/MilestonesDeploySection.tsx`:**

1. Add state: `celCelebrated` / `setCelCelebrated` (boolean, default false)
2. In the Log Celebration dialog, add a toggle between "Milestone type" and "5-class pack gifted":
   - `<Switch>` with label "Actually celebrated in studio?"
3. Include `actually_celebrated: celCelebrated` in the insert payload
4. Reset `celCelebrated` to false after save
5. Add to edit form: `editCelebrated` state, include in update payload
6. In the celebration list, show a small badge "Celebrated" (green) or "Not yet celebrated" (amber) next to each entry
7. Update the `MilestoneRow` interface to include `actually_celebrated: boolean`

## What does NOT change
- Deploy tab, summary cards, pipeline logic
- Any other page or component
- The "5-class pack gifted" toggle behavior and friend referral flow

