

# Fix My Day "Today's Intros" + VIP Group Bulk Scheduling

## Problem 1: My Day shows VIP class entries as "Today's Intros"
The query in `MyDay.tsx` fetches ALL `intros_booked` where `class_date = today`, which includes VIP class registrations that aren't actual intro appointments. These VIP entries have `lead_source = 'VIP Class'` and often have a `vip_class_name` set.

**Fix:** Add a filter to exclude VIP class bookings from the Today's Intros query:
- Add `.is('vip_class_name', null)` to the query, so only real intro bookings show up
- Alternatively filter by `lead_source` not being `'VIP Class'`, but `vip_class_name` is more reliable since some VIP entries may have varied source names

## Problem 2: Bulk set date/time for a VIP group
Currently each VIP booking must be edited individually. The admin needs a way to select a VIP group and set the class date and time for everyone in that group at once.

**Fix:** Add a "Set Group Schedule" control to the VIP group header in `ClientJourneyPanel.tsx`:
- Next to each VIP group name header (the purple bar), add a button "Set Date & Time"
- Clicking it opens a small inline form or popover with date and time inputs
- On submit, bulk-update all `intros_booked` records in that group (matching `vip_class_name`) with the chosen `class_date` and `intro_time`
- Also update the corresponding `intro_questionnaires` records with `scheduled_class_date` and `scheduled_class_time`
- Show a toast confirming how many bookings were updated

---

## Technical Details

### File: `src/pages/MyDay.tsx` (line 51-57)
Add `.is('vip_class_name', null)` to the intros_booked query to exclude VIP groups from the "Today's Intros" section.

### File: `src/components/admin/ClientJourneyPanel.tsx` (lines 1539-1547)
In the VIP group header rendering:
- Add state for `bulkScheduleGroup` (tracks which group is being edited), `bulkDate`, and `bulkTime`
- Add a "Set Schedule" button to the purple group header bar
- When clicked, show date + time inputs inline
- On confirm, run a Supabase update:
  ```sql
  UPDATE intros_booked SET class_date = $date, intro_time = $time
  WHERE vip_class_name = $groupName AND deleted_at IS NULL
  ```
- Also update linked `intro_questionnaires`:
  ```sql
  UPDATE intro_questionnaires SET scheduled_class_date = $date, scheduled_class_time = $time
  WHERE booking_id IN (SELECT id FROM intros_booked WHERE vip_class_name = $groupName)
  ```
- Show toast: "Updated X bookings for {groupName}"

### Files changed:
1. `src/pages/MyDay.tsx` -- add VIP exclusion filter
2. `src/components/admin/ClientJourneyPanel.tsx` -- add bulk schedule UI and logic to VIP group headers
