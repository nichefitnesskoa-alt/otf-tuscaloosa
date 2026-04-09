

# Fix Outcome Drawer + Follow-Up Card Simplification

## Three changes

### 1. Remove "Prepped before class" checkbox from OutcomeDrawer

**File: `src/components/myday/OutcomeDrawer.tsx`**
- Delete the entire prepped toggle block (lines ~457-480) — the checkbox with "Prepped before class" label
- Remove the `preppedBeforeClass` / `setPreppedBeforeClass` state (line 108) and `initialPrepped` prop usage
- Keep the prop in the interface for backward compatibility but ignore it

### 2. Fix "Planning to Reschedule" duplicate constraint error

**Root cause:** The unique constraint `follow_up_queue_booking_touch_unique (booking_id, touch_number, person_type)` prevents inserting new `planning_reschedule` rows when old ones exist (set to `status: 'dormant'` but not deleted).

**File: `src/components/myday/OutcomeDrawer.tsx`** (lines ~303-307)
- Change the dormant update to a **delete** instead:
  ```
  await supabase.from('follow_up_queue')
    .delete()
    .eq('booking_id', bookingId)
    .eq('person_type', 'planning_reschedule');
  ```
- Also delete any `pending` entries of other types for this booking to avoid stale data:
  ```
  await supabase.from('follow_up_queue')
    .delete()
    .eq('booking_id', bookingId)
    .eq('status', 'pending');
  ```

Also fix the same issue for "Planning to Book 2nd Intro" (lines ~244-248) — the `person_type` values `book_2nd_intro_day2` and `book_2nd_intro_day7` violate the check constraint. Fix by using allowed values (`didnt_buy`) or add a migration to expand the constraint. **Migration approach:** expand the check constraint to include the new person types.

**Database migration:**
```sql
ALTER TABLE public.follow_up_queue 
  DROP CONSTRAINT IF EXISTS follow_up_queue_person_type_check;

ALTER TABLE public.follow_up_queue 
  ADD CONSTRAINT follow_up_queue_person_type_check 
  CHECK (person_type = ANY (ARRAY[
    'no_show', 'didnt_buy', 'planning_reschedule',
    'book_2nd_intro_day2', 'book_2nd_intro_day7'
  ]));
```

### 3. Simplify follow-up card actions to only: Send Text, Copy Phone, Log Outcome

**File: `src/features/followUp/FollowUpList.tsx`**
- Remove "Book 2nd Intro" / "Book Now" / "Mark Sold" secondary action button (lines ~453-460)
- Remove "Log as Done" button (lines ~472-480)
- Remove `handleSecondaryAction`, `handleLogDone` functions and `loggingDone` state
- Keep three buttons in a single row: Send Text, Copy Phone (icon), Log Outcome

**File: `src/features/followUp/CoachFollowUpList.tsx`**
- Remove "Book 2nd Intro" button (lines ~285-292)
- Remove "Log as Done" button (lines ~301-309)
- Remove `handleBook2nd`, `handleLogDone` functions and `loggingDone` state
- Add Copy Phone button and Log Outcome button
- Keep: Send Text, Copy Phone, Log Outcome, Not Interested (swipe or small button)

**File: `src/features/followUp/PlansToRescheduleTab.tsx`**
- Remove "Book Intro" button, "Log as Sent" button from action buttons
- Keep: Send Text, Copy Phone, Log Outcome

## What does NOT change
- Outcome drawer outcome options (sale types, non-sale types, reschedule types)
- Follow-up data queries or priority logic
- Coach view intro cards
- Pipeline, WIG, or any other page

