## What is actually wrong

1. The “delete” button only invalidates the generic `fv_scorecards` query. The WIG section is powered by `fv_trend_scorecards`, and the inline Coach View is powered by the card’s resolved scorecard id. So after deletion, the UI can keep showing the old submitted scorecard from cached state.
2. The current deleted/cleared Natalya record still exists in the database as a submitted `0/30` scorecard with zero bullets:
  - `evaluatee_name = Natalya`
  - `class_date = 2026-05-11`
  - `total_score = 0`
  - `submitted_at` is still present
   That means WIG is correctly reading it as a real submitted scorecard unless we remove it.
3. The week table is grouping with browser/local `date-fns` week math. The app requirement is Central Time, and this feature needs the label to be explicit: `Week starting 5/11`, with 5/11 through 5/17 intros in that column.

## Files I will change

- `src/components/scorecard/ScorecardForm.tsx`
- `src/components/coach/CoachIntroCard.tsx`
- `src/components/scorecard/UnscoredDrillDown.tsx`
- `src/components/scorecard/CoachScorecardGrid.tsx`
- possibly `src/lib/scorecard/trends.ts` only if needed to keep scorecard week logic canonical

## Implementation plan

1. **Make delete actually behave like “it never happened”**
  - Keep the hard delete of `fv_scorecards`.
  - After the delete succeeds, clear local form state so it no longer renders the deleted score as `0/30`.
  - Change the callback contract so delete notifies parents as a delete event, not as a submitted score event.
2. **Refresh every affected cache after delete**
  - In Coach View, invalidate:
    - `fv_scorecards`
    - `fv_scorecard`
    - `fv_trend_scorecards`
    - `fv_trend_ran_first_intros`
  - This ensures Coach View, WIG table, WIG tiles, drilldowns, and unscored counts all re-read the database after the delete.
3. **Remove Natalya’s current bad submitted zero row**
  - Delete the existing `fv_scorecards` row for Natalya on `2026-05-11` that has no bullets and `total_score = 0`.
  - Because bullets/comments already cascade or are empty, this removes it from WIG entirely.
4. **Fix WIG weekly grouping and labels**
  - Replace the table header text from `wk 5/11` to `Week starting 5/11`.
  - Use local date parsing for `class_date` everywhere in `CoachScorecardGrid` instead of ambiguous browser `Date` behavior.
  - Make each week column cover exactly Monday 00:00 through Sunday 23:59 in local/Central business logic, so a `2026-05-11` scorecard lands under `Week starting 5/11`, not `5/4`.
  - Update the drilldown label to match: `Natalya · Week starting 5/11`.
5. **Verify with real data**
  - Query the database to confirm Natalya no longer has the `2026-05-11` submitted `0/30` scorecard.
  - Confirm the WIG scorecard query no longer returns that row.
  - Confirm date math places `2026-05-11` in the week starting `5/11`.

## Scope guard

No business logic, scoring formula, role logic, or UI redesign. This is strictly deletion correctness, cache invalidation, and week-start labeling/grouping.  
  
SCORECARD DELETE + WEEK GROUPING FIX

WHY THIS MATTERS

The delete button on scorecards does not propagate correctly.

After deletion, WIG still shows 0/30 because the cache is not 

fully invalidated and the bad database row still exists.

The week grouping in the WIG table is also wrong — 5/11 shows 

under week starting 5/4. Both need to be fixed together.

SCOPE GUARD

No business logic changes. No scoring formula changes.

No role logic changes. No UI redesign.

Deletion correctness, cache invalidation, and week labeling only.

FILES IN SCOPE

  src/components/scorecard/ScorecardForm.tsx

  src/components/coach/CoachIntroCard.tsx

  src/components/scorecard/UnscoredDrillDown.tsx

  src/components/scorecard/CoachScorecardGrid.tsx

  src/lib/scorecard/trends.ts (only if needed for canonical 

    week logic — do not change anything else in this file)

─────────────────────────────────────────────

FIX 1 — MAKE DELETE BEHAVE LIKE IT NEVER HAPPENED

─────────────────────────────────────────────

In ScorecardForm.tsx:

  Keep the hard delete of fv_scorecards row.

  After delete succeeds:

    Clear all local form state so the component no longer 

    renders the deleted score as 0/30.

    The form should return to its pre-submission empty state.

  

  Change the delete callback contract:

    The delete event must notify parent components as a 

    DELETE event, not as a submitted score event.

    Parent components that receive a delete notification 

    must treat the scorecard as non-existent.

    No 0/30 should ever propagate upward from a delete.

─────────────────────────────────────────────

FIX 2 — INVALIDATE ALL AFFECTED CACHES AFTER DELETE

─────────────────────────────────────────────

In CoachIntroCard.tsx after a successful delete:

  Invalidate ALL of these query keys:

    fv_scorecards

    fv_scorecard

    fv_trend_scorecards

    fv_trend_ran_first_intros

  

  Do not invalidate only fv_scorecards.

  All four must be invalidated together in the same 

  onSuccess or onSettled callback.

  

  This ensures Coach View, WIG table, WIG tiles, 

  drilldowns, and unscored counts all re-read the 

  database immediately after deletion.

In UnscoredDrillDown.tsx:

  After receiving a delete notification from a child:

    Invalidate the same four query keys.

    Re-fetch unscored count.

─────────────────────────────────────────────

FIX 3 — DELETE NATALYA'S BAD DATABASE ROW

─────────────────────────────────────────────

There is currently a submitted fv_scorecards row with:

  evaluatee_name = Natalya

  class_date = 2026-05-11

  total_score = 0

  submitted_at is present (non-null)

  bullet scores are all zero or empty

This row must be deleted from the database.

Use a Supabase migration or direct delete query:

  DELETE FROM fv_scorecards 

  WHERE evaluatee_name = 'Natalya'

  AND class_date = '2026-05-11'

  AND total_score = 0;

After running this:

  Verify the row no longer exists.

  Verify the WIG scorecard query no longer returns 

  any submitted scorecard for Natalya on 2026-05-11.

  Verify WIG tiles and table no longer show 0/30 

  for Natalya.

─────────────────────────────────────────────

FIX 4 — WIG WEEKLY GROUPING AND LABELS

─────────────────────────────────────────────

In CoachScorecardGrid.tsx:

  PROBLEM: Week grouping uses ambiguous browser Date 

  behavior that places 2026-05-11 under week of 5/4.

  FIX: Replace all week math with explicit local date 

  parsing. Do not use new Date(dateString) directly — 

  parse the date string as local date explicitly to 

  avoid timezone offset shifting the date.

  Parse class_date strings as local dates:

    const [year, month, day] = dateString.split('-').map(Number);

    const localDate = new Date(year, month - 1, day);

  

  Week start calculation:

    Each week starts on Monday.

    For any given date, find the Monday of that week:

      const dayOfWeek = localDate.getDay(); 

        // 0=Sun, 1=Mon, ..., 6=Sat

      const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

      const weekStart = new Date(localDate);

      weekStart.setDate(localDate.getDate() - daysToMonday);

    

    Use weekStart as the grouping key formatted as YYYY-MM-DD.

  Verify: 2026-05-11 is a Monday.

    dayOfWeek = 1, daysToMonday = 0.

    weekStart = 2026-05-11.

    This scorecard belongs to week starting 5/11. Correct.

  Verify: 2026-05-08 is a Friday.

    dayOfWeek = 5, daysToMonday = 4.

    weekStart = 2026-05-04.

    This scorecard belongs to week starting 5/4. Correct.

  WEEK COLUMN HEADER LABEL:

    Change from: "wk 5/11" or "5/11"

    Change to: "Week starting 5/11"

    Format: "Week starting M/D" where M and D have no 

    leading zeros.

  DRILLDOWN LABEL:

    Update to match: "Natalya · Week starting 5/11"

    Same format as column header.

  INTRO MEMBERSHIP IN WEEK:

    All intros with class_date falling between 

    Monday 2026-05-11 and Sunday 2026-05-17 inclusive 

    must appear in the "Week starting 5/11" column.

    Use the same local date parsing for all intro dates.

    Do not use UTC date comparison for any of this logic.

─────────────────────────────────────────────

DOWNSTREAM CHANGES — verify all before marking done

─────────────────────────────────────────────

A. Delete button in ScorecardForm clears local state 

   after deletion. No 0/30 shown after delete.

B. Delete notifies parents as DELETE event, not submit.

C. Four query keys invalidated after every delete:

   fv_scorecards, fv_scorecard, 

   fv_trend_scorecards, fv_trend_ran_first_intros.

D. Natalya's 2026-05-11 0/30 row deleted from database.

   WIG no longer shows any submitted score for Natalya 

   on that date.

E. All class_date strings parsed as local dates in 

   CoachScorecardGrid. No new Date(string) ambiguity.

F. Week grouping uses Monday as week start.

   2026-05-11 lands in Week starting 5/11.

   2026-05-08 lands in Week starting 5/4.

G. Week column headers read "Week starting M/D".

H. Drilldown labels read "Coach · Week starting M/D".

I. All intros between 5/11 and 5/17 appear in 

   Week starting 5/11 column.

J. No business logic, scoring formula, role logic, 

   or UI redesign changes.

K. No files outside the scope list touched.