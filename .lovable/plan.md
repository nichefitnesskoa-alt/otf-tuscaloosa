
# Fix 2nd Intro Chain: Kaylee Davis, Denise Davis, Keirra Matthew

## Problem Summary

All three members came in on **Feb 4** for their **1st intro** (run logged by Grace, result = "Booked 2nd intro"). Grace then booked them for a **2nd visit on Feb 11** and entered the lead source as "2nd Class Intro (staff booked)". However, **no 1st intro booking record exists** — only the Feb 11 booking exists, so the Feb 4 runs are incorrectly linked to the Feb 11 (2nd intro) booking, breaking the chain.

## What Needs to Happen

For each of the 3 members, in one database operation:

### Step 1 — Create backfill 1st-intro booking (Feb 4)
Insert a new `intros_booked` record with:
- `class_date`: `2026-02-04` (one week before the Feb 11 booking)
- `lead_source`: `Instagram DM` (as requested, correcting from "2nd Class Intro")
- `intro_owner`: `Grace`
- `booked_by`: `Grace`
- `sa_working_shift`: `PM` (17:30 class time = PM shift)
- `booking_status`: `Active`
- `booking_status_canon`: `ACTIVE`
- `booking_type_canon`: `STANDARD`
- `is_vip`: `false`

### Step 2 — Re-link Feb 4 runs to the new 1st booking
Update each `intros_run` record (`run_date = 2026-02-04`) so that `linked_intro_booked_id` points to the new backfilled 1st booking (not the Feb 11 booking).

### Step 3 — Update Feb 11 bookings to be proper 2nd-intro bookings
Update each Feb 11 `intros_booked` record:
- Set `originating_booking_id` = the new 1st booking's ID
- Set `rebooked_from_booking_id` = the new 1st booking's ID
- Set `rebook_reason` = `second_intro`
- Change `lead_source` to `Instagram DM`

## Affected Records

| Member | 1st Booking (to create) | 2nd Booking (Feb 11, to update) | Run (Feb 4, to re-link) |
|---|---|---|---|
| Kaylee Davis | new row | `4deaf0c4-...` | `067c39f5-...` |
| Denise Davis | new row | `49b9dff6-...` | `94662113-...` |
| Keirra Matthew | new row | `63609408-...` | `ae9c12d9-...` |

## Technical Implementation

This is a pure database fix — no code changes needed. Three SQL blocks will be run using CTEs to capture the new IDs:

```sql
-- KAYLEE DAVIS
WITH new_booking AS (
  INSERT INTO intros_booked (member_name, class_date, lead_source, intro_owner, booked_by, sa_working_shift, booking_status, booking_status_canon, booking_type_canon, is_vip, questionnaire_status_canon)
  VALUES ('Kaylee Davis', '2026-02-04', 'Instagram DM', 'Grace', 'Grace', 'PM', 'Active', 'ACTIVE', 'STANDARD', false, 'not_sent')
  RETURNING id
)
UPDATE intros_run SET linked_intro_booked_id = (SELECT id FROM new_booking)
WHERE id = '067c39f5-1d89-424c-8a9f-412860a3cf12';

UPDATE intros_booked SET 
  originating_booking_id = (SELECT id FROM intros_booked WHERE member_name = 'Kaylee Davis' AND class_date = '2026-02-04' ORDER BY created_at DESC LIMIT 1),
  rebooked_from_booking_id = (SELECT id FROM intros_booked WHERE member_name = 'Kaylee Davis' AND class_date = '2026-02-04' ORDER BY created_at DESC LIMIT 1),
  rebook_reason = 'second_intro',
  lead_source = 'Instagram DM'
WHERE id = '4deaf0c4-16ae-4691-8a74-8b2f21c20816';
```

(Repeated for Denise Davis and Keirra Matthew with their respective IDs.)

## Impact on Funnel

After this fix:
- The Feb 4 runs will be recognized as **1st intro runs**
- The Feb 11 bookings will be proper **2nd intro bookings** (via `originating_booking_id`)
- All 3 members will count as **2nd intro purchases** if they buy (matching the `personHasSecondBooking` flag already in the funnel logic)
- The "2nd Class Intro (staff booked)" lead source disappears from the lead source chart for these entries — replaced by "Instagram DM"

## What Does NOT Change

- Commission attribution stays with Grace (she is `intro_owner` on all runs)
- No code changes — this is purely a data correction via SQL
