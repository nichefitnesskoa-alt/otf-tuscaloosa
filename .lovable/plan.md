

# VIP Class Performance Tracking & Booking Integration

## Database Changes

**Migration 1 — Add attendance columns to `vip_sessions`:**
- `actual_attendance` (integer, nullable)
- `attendance_logged_by` (text, nullable)
- `attendance_logged_at` (timestamptz, nullable)

No new columns needed on `intros_booked` — `vip_session_id` already exists.

## Part 1 — Post-Class Attendance Input

**File: `src/features/pipeline/components/VipSchedulerTab.tsx`**

For past sessions (`session_date < today`):
- If `actual_attendance` is null: show amber "Add Attendance" button
- If already logged: show "Attendance: X" with a pencil icon to edit
- Tapping opens inline number input + Save button
- On save: updates `actual_attendance`, `attendance_logged_by` (current user), `attendance_logged_at` (now)
- Shows inline "Saved" confirmation for 2 seconds

Add `actual_attendance`, `attendance_logged_by`, `attendance_logged_at` to the `VipSession` interface.

## Part 2 — Booking from a VIP Class

### Way 1 — Book Directly from VIP Session

**File: `src/features/pipeline/components/VipSchedulerTab.tsx`**

On reserved session rows, add a "Book Intro" button next to "View Registrations". Tapping opens a new dialog that wraps the existing booking form pattern (reuses same field structure as PipelineDialogs' CreateNewBooking) with:
- `lead_source` pre-filled as "VIP Class" (read-only)
- `vip_session_id` pre-filled (hidden field)
- Read-only display: "VIP Class: [group] — [date]"
- All other fields (name, date, time, coach, SA) blank and editable as normal
- On save: inserts into `intros_booked` with `vip_session_id` set

### Way 2 — Tag Existing Intro

**File: `src/components/myday/EditBookingDialog.tsx`**

Add a "Link to VIP Class" button below existing fields. Tapping opens a searchable dropdown of all `vip_sessions` (ordered by `session_date` desc), showing "[Group name] — [date] at [time]". Selecting sets `vip_session_id` and `lead_source = 'VIP Class'` on the booking. Shows confirmation inline.

### Way 3 — Lead Source Dropdown Update

**Files: `src/components/dashboard/BookIntroSheet.tsx`, `src/features/pipeline/components/PipelineDialogs.tsx`**

"VIP Class" is already in the `LEAD_SOURCES` constant. When "VIP Class" is selected as lead source:
- Show a second dropdown: "Which VIP class?"
- Populated from `vip_sessions` where status = 'reserved' or 'completed', ordered by `session_date` desc
- Shows "[Group name] — [date]"
- If not selected, show amber warning "Please select which VIP class" — required validation
- On save: set `vip_session_id` on the `intros_booked` record

**File: `src/components/myday/EditBookingDialog.tsx`** — Same conditional VIP class picker when lead source is "VIP Class".

## Part 3 — VIP Class Performance Summary

**File: `src/features/pipeline/components/VipSchedulerTab.tsx`**

In the View Registrations dialog, add a performance summary card at the top (before group contact card):

**Row 1** (three metrics):
- Registered: count of `vip_registrations` (non-group-contact)
- Attended: `actual_attendance` value (or "—" with amber "Add attendance" link)
- Show rate: attended/registered % (or "—")

**Row 2** (three metrics):
- Intros booked: count of `intros_booked` where `vip_session_id` = session
- Intros ran: count of `intros_booked` where `vip_session_id` = session AND `booking_status_canon` = 'SHOWED'
- Joins: count of `intros_run` where linked booking's `vip_session_id` = session AND `result_canon` = 'SALE'

Conversion note below metrics with green/muted text based on joins count.

Data fetched when dialog opens alongside registrations. Uses same silent-refresh patterns.

## Part 4 — VIP Performance in Studio Tab

**File: `src/pages/Recaps.tsx`**

Add a new collapsible "VIP Class Performance" section after the existing Studio sub-tabs. Contains:

**Summary row**: "All time: X VIP classes · X total attended · X joins · X% avg join rate"

**Table** of past `vip_sessions` with columns: Date, Group, Registered, Attended, Intros Booked, Intros Ran, Joins, Join Rate. Join rate denominator indicator: "based on attended" or "based on registered (attendance not logged)".

Tapping a row opens the View Registrations panel for that session (reuses same dialog component extracted from VipSchedulerTab).

New component: `src/components/admin/VipClassPerformanceTable.tsx` — fetches past sessions with aggregated metrics via joins to `vip_registrations`, `intros_booked`, and `intros_run`.

## Files Modified/Created

1. **Migration** — add 3 columns to `vip_sessions`
2. `src/features/pipeline/components/VipSchedulerTab.tsx` — attendance input, Book Intro button, performance summary in registrations dialog
3. `src/components/myday/EditBookingDialog.tsx` — "Link to VIP Class" button + picker
4. `src/components/dashboard/BookIntroSheet.tsx` — conditional VIP class picker when "VIP Class" selected
5. `src/features/pipeline/components/PipelineDialogs.tsx` — conditional VIP class picker in booking form
6. `src/components/admin/VipClassPerformanceTable.tsx` — **new** — Studio tab VIP performance table
7. `src/pages/Recaps.tsx` — add VIP Class Performance collapsible section in Studio tab

## Consistency Guarantees

- All VIP-tagged intros use `lead_source = 'VIP Class'` consistently for attribution
- Existing lead source analytics will correctly pick up VIP Class as a source (already in `LEAD_SOURCES`)
- `vip_session_id` foreign key enables precise per-class tracking
- Attendance available to all staff roles

