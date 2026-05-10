## Investigation proof

- Hemline Tuscaloosa exists in `vip_sessions`:
  - `id`: `5b10840e-d4aa-41fe-8d36-9b243e876ccf`
  - `reserved_by_group`: `Hemline Tuscaloosa`
  - `session_date`: `2026-05-11`
  - `session_time`: `08:45:00`
  - `status`: `reserved`
- Hemline has `2` rows in `vip_registrations`.
- For the selected visible week of May 11-17:
  - Standard intros count: `0`
  - Reserved VIP groups count: `1`

## Root cause

The hook now fetches the VIP group correctly, but the UI still hides it because the selected day is filtered like this:

```text
selectedDayItems = items.filter(i => i.classDate === selectedDate)
```

The session replay shows the user moved My Day to the next week. On week navigation, the page first renders a loading state with the VIP count, then the selected date state and fetched item state fall out of sync and the Monday panel renders `No intros scheduled for Monday.`

There is also a second UX blocker: VIP cards are nested inside a time accordion that defaults closed. Even when the item is present, staff may only see an `8:45 AM — 1 VIP group` row, not the actual VIP group intro card.

## Map the reach

This change touches the My Day upcoming intros system only:

- Reads changed data:
  - `useUpcomingIntrosData.ts` reads `vip_sessions` and `vip_registrations`.
  - `UpcomingIntrosCard.tsx` reads hook items and filters by selected day.
  - `IntroDayGroup.tsx` renders time groups and passes VIP session items to cards.
  - `IntroRowCard.tsx` renders the actual VIP group card and opens `VipRegistrationsSheet`.
- Writes changed data:
  - No write behavior changes.
  - Existing VIP outcome/coach writes in `VipRegistrationsSheet.tsx` stay unchanged.
- Calculates metrics from changed data:
  - Day tab badges use `dayCounts`.
  - Day group counts separate true intros vs VIP groups.
  - Q summary should not count VIP groups as questionnaires-needed.
- Displays derived state:
  - Empty state copy.
  - Day tab badge count.
  - Time accordion labels.
  - VIP group card.
- Shared rules:
  - VIP group items use `isVipSession` and must not be treated as normal intros.
  - VIP group visibility must agree between day tabs, selected day body, and time group card list.

## Implementation plan

1. Keep the VIP data fetch as-is, because the real Hemline row proves the query shape is correct.

2. Make selected-day filtering resilient in `UpcomingIntrosCard.tsx`:
   - Use a canonical selected-day item helper inside the component.
   - If the selected date has no items but the current week has VIP sessions, keep the date selection and body in sync so the VIP group is visible instead of rendering an empty state.
   - Ensure day counts include VIP session items so the Monday tab badge shows `1`.

3. Fix the summary/Q counts in `UpcomingIntrosCard.tsx`:
   - Exclude `isVipSession` from questionnaire-needed math.
   - Show wording that includes VIP groups when the day contains only VIP groups.

4. Make VIP groups immediately visible in `IntroDayGroup.tsx`:
   - Auto-open time sections that contain any VIP group.
   - Keep regular intro time sections behavior unchanged.

5. Add one small canonical helper if needed for My Day filtering/counting:
   - `isVipSessionItem(item)` or local helper if only used in this surface.
   - Use it consistently for day counts, Q summary, active/completed split, and labels.

## Verification plan

After implementation, verify with real data:

- Database check:
  - Hemline Tuscaloosa VIP session still returns `1` reserved row for `2026-05-11 08:45`.
  - Registration count returns `2`.
- UI data check:
  - My Day week of May 11-17 has Monday badge count `1`.
  - Monday selected body renders Hemline Tuscaloosa, not `No intros scheduled for Monday.`
  - The `8:45 AM` section is open enough for staff to see the VIP group card without guessing.
- Metric consistency:
  - Standard intro count remains `0`.
  - VIP group count remains `1`.
  - Q needed count remains `0` for VIP-only day.
- Regression checks:
  - Regular intro cards still render under their day/time.
  - VIP groups do not appear in needs-outcome mode.
  - Opening the VIP group still shows the registration sheet and its `2` registrants.