

# Friend Booking Flow in Shift Recap + Script/Questionnaire Link Fixes

## Overview

This plan adds a "Bringing a friend?" prompt to the Intros Booked section of the Shift Recap, fixes the questionnaire link slugs in script merge fields, moves the Send Script button to a more visible position, and creates a referral tracking panel in Admin.

---

## 1. Friend Booking Prompt in IntroBookingEntry

After the user selects a Lead Source, a toggle/prompt appears: **"Are they bringing a friend?"**

When toggled on:
- A friend info section expands (same pattern as `BookIntroDialog`)
- Fields: First Name (required), Last Name, Phone (required), Email
- The intro date, time, and coach auto-copy from the current booking
- On shift recap submission, the system:
  - Creates a second `intros_booked` record for the friend (same date/time/coach)
  - Sets the friend's `lead_source` to the appropriate "(Friend)" variant (e.g., "Instagram DMs" becomes "Instagram DMs (Friend)")
  - Cross-links both bookings via `paired_booking_id`
  - Auto-creates a questionnaire for the friend (using `QuestionnaireLink` logic)
  - Notes the referral relationship in both booking records

### Changes to `IntroBookingData` interface:
- Add `bringingFriend: boolean`
- Add `friendFirstName`, `friendLastName`, `friendPhone`, `friendEmail` fields

### Changes to `IntroBookingEntry.tsx`:
- Add the friend toggle UI after Lead Source select
- When friend is enabled, show friend name/phone/email fields
- Auto-create a second `QuestionnaireLink` for the friend
- Pass `friend-questionnaire-link` into the script merge context so confirmation scripts auto-populate both links

### Changes to `ShiftRecap.tsx` submission logic:
- When a booking has `bringingFriend = true`, create a second `intros_booked` record
- Cross-link via `paired_booking_id`
- Link the friend's questionnaire to the friend's booking

---

## 2. Fix Questionnaire Link in Script Merge Context

**Bug**: The `IntroBookingEntry` uses `useState(() => {...})` to fetch the slug -- this is incorrect (should be `useEffect`). This causes the slug fetch to fail, so the fallback UUID-based link is used instead of the name-based slug.

### Fix in `IntroBookingEntry.tsx`:
- Replace the `useState(() => {...})` slug fetch (lines 77-87) with a proper `useEffect`
- This ensures the slug is fetched correctly and the `questionnaire-link` merge field uses the `/q/john-smith` format instead of `/q/uuid`

---

## 3. Move "Send Script" Button

### Changes to `IntroBookingEntry.tsx`:
- Remove the small `Send` icon button from the top-right corner (lines 184-192)
- Add a full-width black "Send Script" button at the bottom, after the QuestionnaireLink and QuestionnaireResponseViewer sections
- Styled as: `className="w-full bg-black text-white hover:bg-black/90"` with text "Send Script"

---

## 4. Referral Tracking in Admin

### New database table: `referrals`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| referrer_booking_id | uuid | The person who brought the friend |
| referred_booking_id | uuid | The friend's booking |
| referrer_name | text | Display name |
| referred_name | text | Display name |
| discount_applied | boolean | Default false -- admin checks this off |
| created_at | timestamptz | |

RLS: Open read/insert/update (matching existing table patterns).

### New component: `src/components/admin/ReferralTracker.tsx`
- Fetches from `referrals` table
- Shows a list of referral pairs with referrer name, referred name, date
- Each row has a checkbox to mark "Discount Applied" ($50 off)
- Admin can filter by pending vs. applied

### Add tab to Admin page:
- New "Referrals" tab in the Admin Tabs component

---

## 5. Friend Questionnaire Link in Scripts

When `bringingFriend` is enabled and the friend's questionnaire is created:
- The friend's slug-based link is passed as `friend-questionnaire-link` in the merge context
- Confirmation scripts (e.g., template 1C) that contain `{friend-questionnaire-link}` will auto-populate with the friend's unique questionnaire URL

---

## Technical File Summary

| Action | File |
|--------|------|
| Edit | `src/components/IntroBookingEntry.tsx` -- Add friend toggle, fix slug useEffect, move Send Script button, pass friend questionnaire link |
| Edit | `src/pages/ShiftRecap.tsx` -- Handle friend booking creation on submit, cross-link paired_booking_id, link friend questionnaire |
| Migration | Create `referrals` table with RLS policies |
| Create | `src/components/admin/ReferralTracker.tsx` -- Referral discount tracking panel |
| Edit | `src/pages/Admin.tsx` -- Add Referrals tab |

