## Plan

I’ll fix the Own It page so the page itself always shows everyone’s answers at a glance, export never replaces that on-screen view, and next week uses the same layout as this week.

## What I found

- The May 11 data is in the database: 4 submitted owner entries, including Kaiya’s Space Owner and VIP Owner answers.
- The page is currently treating May 11 as `Past` because the current-week helper is actually returning the next Monday after Sunday. Today is Tuesday, May 12, so it defaults to May 18 instead of staying on May 11.
- The May 11 answers only show in the special past-week block. Current and future weeks use a different layout, so next week looks different.
- The export button expands into copy/download controls in the header, which can feel like it replaces the at-a-glance screen view instead of being separate from it.

## Changes to make

1. **Fix the default Own It week**
   - Replace the misleading `nextMondayCT()` behavior with a true current-week Monday helper anchored to America/Chicago.
   - Monday through Sunday will stay on that same week.
   - The page will not roll to next week until the following Monday.

2. **Make owner answers visible directly on the page**
   - Add a single “Owner answers at a glance” section that appears for past, current, and future weeks.
   - Show every active owner/lane in that section.
   - If they entered answers, show the answer text even if the week moved forward.
   - If they haven’t entered anything, show a clear “No answer yet” state.
   - Do not require Export Team Meeting or Past Meetings to see answers.

3. **Make next week look like this week**
   - Use the same visible sections for future weeks as current week.
   - Keep action items, wins, owner answers, and the studio leader close area in consistent positions.
   - Future weeks can still be edited/planned, but the page structure will not change just because it’s next week.

4. **Keep export separate from on-screen answers**
   - Leave Export Team Meeting as an action button only.
   - Prevent its expanded copy/download state from visually taking over the header.
   - The answers-at-a-glance section remains on the page whether export is opened or not.

## Files expected to change

- `src/hooks/useTheTable.ts`
- `src/pages/TheTable.tsx`
- `src/components/table/ExportTeamMeetingButton.tsx`

## Verification after implementation

- Confirm May 12 defaults to week of May 11, not May 18.
- Confirm May 11 shows Kaiya’s submitted answers directly on `/the-table`.
- Confirm moving to next week keeps the same page structure.
- Confirm Export Team Meeting no longer hides or replaces the on-page answers.