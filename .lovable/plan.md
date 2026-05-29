# Weekly Coach Scorecard Grid in WIG Section

Add a coach-focused, week-over-week scorecard table inside the WIG section of the Team Meeting page so leadership can scan First Visit Scorecard totals at a glance.

## What you'll see

A new sub-section in `WigSection` titled **"Coach Lead Measure — First Visit Scorecard (Push Level 25+)"** with a table:

```text
              | wk of 5/18 | wk of 5/25 | wk of 6/1 | wk of 6/8 | wk of 6/15 | wk of 6/22 |
Jo            |   26/30 ●  |   29/30 ●  |    —      |    —      |     —      |     —      |
AG            |   19/30 ●  |     —      |    —      |    —      |     —      |     —      |
Maddie        |   24/30 ●  |     —      |    —      |    —      |     —      |     —      |
Richmond      |     X      |     —      |    —      |    —      |     —      |     —      |
Hillary       |   24/30 ●  |     —      |    —      |    —      |     —      |     —      |
Ryan          |   23/30 ●  |   26/30 ●  |    —      |    —      |     —      |     —      |
```

Rules:

- Rows = canonical coach list (`COACHES`).
- Columns = the last 6 weeks (Mon–Sun, America/Chicago), oldest → newest, ending with the current week.
- Cell shows the coach's **highest** `fv_scorecards.total_score` for that week as `total/30`.
  - If multiple scorecards exist that week, show best score (matches "level up" intent). Tooltip lists all.
  - If no scorecard was submitted that week → render `X` in red (matches reference image).
- Color dot next to score: green ≥ 25 (Push), amber 12–24, red < 12 — mirrors `scoreToLevel`.
- Target callout above table: "Lead Measure: All Coaches will increase to a Push Level (25+) on the First Visit Scorecard."
- Present mode: larger fonts on white-on-dark, same grid.
- Print/normal mode: compact, horizontal scroll on mobile.

## Data

- Pull `fv_scorecards` for the last 6 weeks via existing `useScorecards({ from, to })` hook.
- Group by `evaluatee_name` × ISO-week start (CST). No new tables, no migration.
- Use `COACHES` from `src/types` as the row order (so a coach with zero scorecards still appears, all `X`).

## Files

- **New** `src/components/meeting/CoachScorecardGrid.tsx` — pure presentational grid, takes scorecards + week list, renders table for both present and normal modes.
- **Edit** `src/components/meeting/WigSection.tsx` — add `coachScorecards` prop, render `<CoachScorecardGrid>` below the existing Per-SA Lead Measures table.
- **Edit** `src/pages/Meeting.tsx` — call `useScorecards({ from: 6-weeks-ago, to: today })`, pass into `WigSection`.

No DB changes. No role/permission changes (meeting page already gated).

## Verification

- Coach with 2 scorecards in same week shows the higher score, tooltip lists both.
- Coach with zero scorecards in window → all `X` cells.
- Week boundaries: a Sunday-night class falls in that week, Monday morning class in the next — verify with one real record in each.
- Present mode renders without overflow on the projector resolution used for Tuesday meetings.  
  
  
That's an example of coaches that Auburn uses. Those aren't our coaches. Make sure our coaches are on there