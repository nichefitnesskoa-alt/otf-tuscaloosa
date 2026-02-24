# Restructure Lead Measures Table + Add Outreach Tab

## What Q% Actually Is

**Q%** = Questionnaire Completion Rate. It counts what percentage of 1st intro bookings (non-VIP, non-2nd-intro) attributed to an SA have `questionnaire_status_canon === 'completed'`. This measures whether the SA sent the questionnaire and the client filled it out before their intro. The code at line 86 of `useLeadMeasures.ts` confirms this. We also need to add meanings to the different columns when highlighting over it

## Changes

### 1. Add `introsRan` to the lead measures data — `src/hooks/useLeadMeasures.ts`

- Add `introsRan: number` to the `SALeadMeasure` interface
- Add `introsRan: number` to the saMap aggregation object (initialized to 0)
- After the existing bookings loop, add a new loop over `runs` to count intros per SA using `intro_owner` (falling back to `sa_name`), filtered to ALL_STAFF
- Include `introsRan` in the result mapping

### 2. Slim down LeadMeasuresTable — `src/components/dashboard/LeadMeasuresTable.tsx`

Strip the table to show only 3 columns per SA:

- **Q%** — questionnaire completion rate (keep existing color logic)
- **Prep%** — prep rate (keep existing color logic)
- **Intros Ran** — new column from the hook

Remove: Speed to Lead, Follow-Up Touches, DMs Sent, Leads Reached columns. Update the footer text accordingly.

### 3. Add "Outreach" tab next to Runner Stats / Booker Stats — `src/pages/Recaps.tsx`

- Change the tabs from 2 columns to 3: `Runner Stats | Booker Stats | Outreach`
- The Outreach tab renders a new table showing per-SA: Speed to Lead, Follow-Up Touches, DMs Sent, Leads Reached (the columns removed from LeadMeasuresTable)
- Reuse the `leadMeasures` data already fetched — no new queries needed
- The Outreach tab content will use a simple table component (can inline or create a small `OutreachTable` component)

### 4. Filter outreach tab by employee — `src/pages/Recaps.tsx`

Apply the same `selectedEmployee` filter to the outreach data, consistent with how Runner Stats and Booker Stats are filtered.

## Files Changed


| File                                             | Change                                                   |
| ------------------------------------------------ | -------------------------------------------------------- |
| `src/hooks/useLeadMeasures.ts`                   | Add `introsRan` field, aggregate from `runs`             |
| `src/components/dashboard/LeadMeasuresTable.tsx` | Remove Speed/FU/DMs/Leads columns, add Intros Ran column |
| `src/pages/Recaps.tsx`                           | Add 3rd "Outreach" tab with Speed/FU/DMs/Leads table     |
