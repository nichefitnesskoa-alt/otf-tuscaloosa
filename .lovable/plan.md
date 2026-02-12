
# Fix: Friend Bookings Not Detected as 2nd Intros + Follow-up Improvements

## Root Cause

Lydia Guyse has only **one** record in the database. When she was booked as Abbie Randol's friend via the "Bringing a friend?" toggle, the system created a single booking for her. The intro type detection hook (`useIntroTypeDetection`) determines 2nd intros by checking:

1. Does the booking have an `originating_booking_id`? -- Lydia's is `null`
2. Does the same name appear in multiple bookings? -- Lydia only has one record

Since neither condition is met, she's classified as a 1st intro despite `booking_status` being "2nd Intro Scheduled." The hook doesn't use `booking_status` at all.

**Secondary issue:** Lydia's `phone` and `email` are both `null` because the friend sub-form data (phone/email) was not being saved to the `intros_booked` record during submission.

---

## Plan

### 1. Save friend phone and email to their booking record
Both the instant-submit and full-submit paths in `ShiftRecap.tsx` create the friend's `intros_booked` record but never include `phone` or `email` from the friend sub-form. Add these fields to both insert calls.

**File:** `src/pages/ShiftRecap.tsx` (two locations: ~line 324 and ~line 526)

### 2. Check for existing bookings when creating friend records
Before inserting a friend booking, query `intros_booked` for any prior booking matching the friend's name or phone. If a match is found:
- Set `originating_booking_id` on the new friend booking to point to the earliest existing record
- This ensures the intro type detection hook correctly identifies it as a 2nd intro

**File:** `src/pages/ShiftRecap.tsx` (both submission paths)

### 3. Include `booking_status` as a fallback in intro type detection
Update `useIntroTypeDetection` to also check `booking_status` containing "2nd" as a tertiary signal when neither `originating_booking_id` nor name-match logic triggers. This provides a safety net for manually-tagged records.

**File:** `src/hooks/useIntroTypeDetection.ts`

### 4. Fix Lydia's existing data
Run a migration to set `originating_booking_id` on Lydia's record to point to Abbie's first booking (since they're friends and Lydia is confirmed as a 2nd intro). This is a one-time data fix.

**SQL migration**

### 5. Include phone-based matching in intro type detection
Currently the hook only matches by `member_name`. Add phone number as a secondary matching key so that even if a name is slightly different (e.g., "Lydia G" vs "Lydia Guyse"), the system can still detect duplicates via phone.

**File:** `src/hooks/useIntroTypeDetection.ts`

---

## Summary of files to modify

| File | Change |
|------|--------|
| `src/pages/ShiftRecap.tsx` | Save friend phone/email; check for prior bookings before inserting friend record |
| `src/hooks/useIntroTypeDetection.ts` | Add phone-based matching and `booking_status` fallback |
| SQL migration | Fix Lydia's `originating_booking_id` data |
