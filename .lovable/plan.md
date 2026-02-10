

# Send Questionnaire Links for Past Bookings

## Problem
Currently, questionnaire links are only generated during new booking entry in the Shift Recap form. There's no way to generate/send links for the 50+ bookings that were already submitted.

## Solution
Add a new "Send Questionnaire Links" section on the Recaps page (or a dedicated tab) that:
1. Pulls all active bookings that don't yet have a questionnaire linked
2. Displays them in a list with name, date, and time
3. Lets the SA generate a questionnaire link for any booking with one tap
4. Shows copy-to-clipboard button and status badge (same as the shift recap form)

## How It Works

1. **New component: `PastBookingQuestionnaires.tsx`**
   - Fetches from `intros_booked` where `booking_status = 'Active'` and no matching `intro_questionnaires` record exists (LEFT JOIN where `iq.id IS NULL`)
   - Also shows bookings that DO have a questionnaire (for copy/status tracking)
   - Displays as a compact card list sorted by class date (newest first)
   - Each card shows: member name, class date/time, and a "Generate Link" button or the existing link + copy button + status badge

2. **"Generate Link" button action:**
   - Creates an `intro_questionnaires` record with the booking's name, date, time, and `booking_id` set to the `intros_booked.id`
   - Immediately shows the link and copy button
   - Reuses the same `QuestionnaireLink`-style UI for consistency

3. **Placement:** Add as a collapsible card on the Recaps page, between the existing sections, titled "Pre-Intro Questionnaire Links". This keeps it accessible without cluttering the main scoreboard view.

## Technical Details

### New file: `src/components/PastBookingQuestionnaires.tsx`
- Fetches bookings from `intros_booked` (active, not deleted) with a LEFT JOIN to `intro_questionnaires` on `booking_id`
- Groups into two lists: "Needs Link" and "Link Sent/Completed"
- Each row has: member name, date, generate/copy button, status badge
- Generate button creates the questionnaire record linking `booking_id` to the actual booking ID
- Copy button copies `{origin}/q/{questionnaire_id}` and updates status to "sent"

### Modified file: `src/pages/Recaps.tsx`
- Import and render `PastBookingQuestionnaires` component in the page layout

### Database
- No schema changes needed -- `intro_questionnaires.booking_id` already exists as a foreign key field
- New records will have `booking_id` properly set (unlike the shift recap flow which sets it to null initially)

### Query logic
```sql
SELECT ib.id, ib.member_name, ib.class_date, ib.intro_time, 
       iq.id as questionnaire_id, iq.status as q_status
FROM intros_booked ib
LEFT JOIN intro_questionnaires iq ON iq.booking_id = ib.id
WHERE ib.deleted_at IS NULL 
  AND ib.booking_status = 'Active'
ORDER BY ib.class_date DESC
```
