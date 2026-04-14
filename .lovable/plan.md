

## Plan: Enhance Pipeline "Add Booking" to Support Reschedule/Rebook from Existing Members

The create booking dialog already has a "Pick from existing pipeline" toggle, but it only copies name/lead source/coach. It needs to function as a proper reschedule flow.

---

### What Changes

**File: `src/features/pipeline/components/PipelineDialogs.tsx`** — Create Booking dialog section (lines ~600-743)

1. **Track the selected journey** — When a pipeline member is picked, store the full journey object (not just name). This gives access to phone, email, intro_owner, and the latest booking ID for linking.

2. **Pre-fill more fields from existing data:**
   - Phone and email from the most recent booking
   - Intro owner from the journey's `latestIntroOwner`
   - Show the selected member's status/last class date in the confirmation chip for context

3. **Link as reschedule** — When creating a booking from an existing pipeline member:
   - Set `rebooked_from_booking_id` to the most recent booking's ID
   - Set `rebook_reason` to "Rescheduled from pipeline"
   - Carry over `intro_owner` and `intro_owner_locked` from the original
   - Auto-complete any pending follow-up queue entries for the original booking (mark as rescheduled)

4. **Show existing member context** — In the selected member chip, show their last class date and current status so the admin knows what they're rescheduling from.

5. **Add phone field** — Add a phone input to the create booking form (pre-filled when picking from pipeline, editable for new bookings too). This ensures the new booking has contact info.

### No new state variables needed beyond:
- `selectedJourney: ClientJourney | null` — to track the full journey when picking from pipeline

### Files Changed
1. `src/features/pipeline/components/PipelineDialogs.tsx` — enhance create booking dialog

