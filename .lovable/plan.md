Implementation plan to fix the Outcome Drawer date picker (Booked 2nd intro):

1. Remove duplicate 2nd-intro date picker block in OutcomeDrawer

- File: `src/components/myday/OutcomeDrawer.tsx`
- Keep only one “2nd Intro Details” section.
- Delete the second duplicated section (`{/* 2nd intro booking fields */}` near the bottom).
- This eliminates two mounted Popovers sharing the same `calendarOpen` state.

2. Keep one popover state per rendered date picker

- In the remaining 2nd-intro section, keep a single `Popover` controlled by `calendarOpen`.
- Ensure no second `Popover` references `calendarOpen` for the same UI path.
- Confirm `onSelect` sets `secondIntroDate` and closes immediately.

3. Normalize initial 2nd-intro date parsing to local-safe parsing

- In `OutcomeDrawer`, replace ad-hoc `new Date(linkedSecondIntro.date + 'T00:00:00')` with the same local Y-M-D parse pattern used in shared form helpers.
- Prevent timezone edge behavior while preloading previously booked 2nd intro dates.

4. Quick interaction hardening

- Add `onClick={(e) => e.stopPropagation()}` to the drawer root wrapper in `OutcomeDrawer` (if not already present) so parent card interactions never collapse/open competing UI while picking dates.

5. Validate end-to-end in the exact failing flow

- My Day → open card Outcome → select “Booked 2nd intro” → click date field → pick date.
- Confirm:
  - Calendar opens once and remains interactive.
  - Selected date renders on the button immediately.
  - Save works and persists date/time/coach.
  - Re-open drawer and verify the saved date preloads correctly.

6. Follow-up cleanup (same pass)

- Address the existing nested button warning in `IntroRowCard` secondary prep control (`button` containing Radix `Checkbox` button) by replacing outer wrapper with a non-button clickable container or removing inner button semantics.
- This reduces interaction conflicts in My Day cards and prevents future click/focus anomalies around popovers.  
  
  
  
  
Make sure you make any subsequent changes that would fix this across the app