

## Plan: Add Reschedule to BookIntroSheet + Remove FAB Buttons

Two changes: enhance the My Day "Book Intro" sheet with a "Pick from Pipeline" toggle (same reschedule flow just built in PipelineDialogs), and remove Walk-In Intro + Log Activity from the FAB.

---

### Change 1 — Remove Walk-In Intro and Log Activity from FAB

**File: `src/components/dashboard/QuickAddFAB.tsx`**
- Remove `Walk-In Intro` and `Log Activity` entries from the `actions` array
- Remove their state variables (`showWalkIn`, `showActivityTracker`) and handlers
- Remove `WalkInIntroSheet` and `ActivityTrackerSheet` imports and rendered components
- Keep: End Shift, Book Intro, Walk-In Sale, Upgrade, HRM Add-On, Follow-Up Purchase

---

### Change 2 — Add "Pick from Pipeline" to BookIntroSheet

**File: `src/components/dashboard/BookIntroSheet.tsx`**

Add a toggle at the top of the sheet: "Reschedule existing member" (Switch + Label).

When toggled on:
- Show a search input that queries `intros_booked` for matching names (distinct members)
- On selection, pre-fill: name (locked), phone, lead source, coach from the most recent booking
- Show a context chip with the member's last intro date and current status
- Track the selected booking ID for linking via `rebooked_from_booking_id`
- On save: set `rebooked_from_booking_id` and `rebook_reason = 'Rescheduled from My Day'`
- Auto-complete any pending `follow_up_queue` entries for the original booking (mark as rescheduled)

When toggled off (default): behaves exactly as today — fresh new booking.

Data source for search: single query to `intros_booked` filtered by name match, ordered by `class_date desc`, limited to 15 results. No need to import the full pipeline journeys system — a lightweight search keeps this sheet fast.

Fields pre-filled from existing booking:
- `member_name` (locked/disabled)
- `phone`
- `lead_source`
- `coach_name`

New state variables:
- `rescheduleMode: boolean`
- `rescheduleSearch: string`
- `searchResults: Array<{id, member_name, phone, lead_source, coach_name, class_date, booking_status_canon}>`
- `selectedBooking: typeof searchResults[0] | null`

Save logic additions (when `selectedBooking` exists):
- Set `rebooked_from_booking_id = selectedBooking.id`
- Set `rebook_reason = 'Rescheduled from My Day'`
- Carry `intro_owner` from the original booking
- After insert: update `follow_up_queue` where `booking_id = selectedBooking.id` and `status = 'pending'` → set `status = 'completed'`

---

### Files Changed
1. `src/components/dashboard/QuickAddFAB.tsx` — remove Walk-In Intro + Log Activity
2. `src/components/dashboard/BookIntroSheet.tsx` — add reschedule toggle with pipeline search

