

# Multi-Feature Update: Questionnaire Changes, Delete Policy, and Pipeline Enhancements

## 1. Delete Non-Completed Questionnaires

**Current state**: The RLS DELETE policy on `intro_questionnaires` only allows deleting records where `status = 'completed'`. This blocks deleting "not_sent" or "sent" records.

**Changes**:
- Update the RLS DELETE policy to allow deleting any questionnaire (remove the `status = 'completed'` restriction)
- Add a delete (trash) button to rows in the **Pending** tab ("Link Generated" section) in `PastBookingQuestionnaires.tsx`, matching the existing delete button style used in the Completed tab
- Update the cleanup edge function condition comment (no code change needed since it already filters by `status = 'completed'` in its query)

---

## 2. Make Q1 (Fitness Goal) Multi-Select

**Current state**: Q1 uses `SelectCard` for single selection, stored as a single string.

**Changes in `src/pages/Questionnaire.tsx`**:
- Change `q1` state from `string` to `string[]` (like Q3)
- Add `q1Other` as existing (already there)
- Render Q1 options as multi-select checkboxes (same pattern as Q3 -- checkbox-style buttons with check icons)
- Update `canProceed` for step 1: `q1.length > 0`
- Update `handleSubmit`: serialize as pipe-delimited string (`q1.map(v => v === 'Other' ? q1Other : v).join(' | ')`)
- Update question text from "What's your #1 health/fitness goal" to "What are your health/fitness goals right now?" with "Select all that apply"

---

## 3. Make Q5 (Emotional Driver) Multi-Select

**Current state**: Q5 uses `SelectCard` for single selection.

**Changes in `src/pages/Questionnaire.tsx`**:
- Change `q5` state from `string` to `string[]`
- Render Q5 options as multi-select checkboxes (same pattern as Q3)
- Update `handleSubmit`: serialize as pipe-delimited string
- Add "Select all that apply" subtitle

---

## 4. Show Lead Source in Client Pipeline (All Tab, Collapsed View)

**Current state**: The collapsed row in the "All" tab shows member name, intro owner, coach, and date. Lead source only appears inside the expanded details.

**Changes in `src/components/dashboard/ClientJourneyReadOnly.tsx`**:
- Add lead source as a small badge/text in the collapsed row metadata (next to date/coach), using the booking's `lead_source` field
- Add a special "Online Intro" badge (e.g., a distinct colored badge like blue/teal) when the lead source is `"Online Intro Offer (self-booked)"` to clearly flag email-parsed online intros
- This badge serves as the "disclaimer" to know it was auto-parsed from email

---

## 5. Questionnaire Link in Shift Recap Booking (Already Exists)

The `IntroBookingEntry` component already includes the `QuestionnaireLink` component which auto-generates and displays questionnaire links when a client name is entered. This is already working. No changes needed here -- the existing flow in the shift recap form already supports creating questionnaire links before submission (the `QuestionnaireLink` component creates records with `booking_id: null` and links them later).

---

## Technical Details

### Database Migration
- Drop the existing DELETE policy on `intro_questionnaires` that restricts to `status = 'completed'`
- Create a new DELETE policy allowing deletion of any record (using `true` condition)

### File Changes

| Action | File |
|--------|------|
| Migration | Update DELETE RLS policy on `intro_questionnaires` to allow all deletes |
| Edit | `src/components/PastBookingQuestionnaires.tsx` -- Add delete button to pending "Link Generated" rows |
| Edit | `src/pages/Questionnaire.tsx` -- Convert Q1 and Q5 from single-select to multi-select |
| Edit | `src/components/dashboard/ClientJourneyReadOnly.tsx` -- Show lead source + "Online Intro" badge in collapsed view |

