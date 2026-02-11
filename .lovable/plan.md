

# Restructure: Separate Client Pipeline + Edge Function Fix

## Overview

Three changes:
1. Stop creating lead records for auto-imported online intros (Format B) -- they go straight to `intros_booked` only
2. Create a new "Pipeline" bottom nav tab housing Client Pipeline, Pre-Intro Questionnaire Links, and Members Who Bought
3. Hide clients from Pre-Intro Questionnaire Links (not Client Pipeline) once their intro has been run

---

## 1. Edge Function Fix

**File:** `supabase/functions/import-lead/index.ts`

For Format B (nested payload), remove all `leads` table logic (steps 3 and 6 -- the upsert and the `booked_intro_id` linking). The function will only:
- Check idempotency via `intake_events`
- Parse date/time
- Dedupe and create `intros_booked` record
- Record `intake_events` (without `lead_id`, since no lead is created)

Format A (flat payload for manual web leads) stays unchanged.

---

## 2. New "Pipeline" Page and Navigation

### New file: `src/pages/Pipeline.tsx`

A simple page containing three sections:
1. Client Pipeline (`ClientJourneyReadOnly`)
2. Pre-Intro Questionnaire Links (`PastBookingQuestionnaires`)
3. Members Who Bought (`MembershipPurchasesReadOnly`)

### Update: `src/components/BottomNav.tsx`

Add "Pipeline" tab (using `GitBranch` icon) between Leads and My Shifts:

```text
Recap | Leads | Pipeline | My Shifts | My Stats | Studio
```

### Update: `src/App.tsx`

Add `/pipeline` route as a protected route.

### Update: `src/pages/Recaps.tsx` (Studio)

Remove the three moved components and their imports:
- `ClientJourneyReadOnly`
- `PastBookingQuestionnaires`
- `MembershipPurchasesReadOnly`

Studio keeps: Studio Scoreboard, Pipeline Funnel, Lead Source Analytics, Top Performers, Runner/Booker Stats, and export actions.

---

## 3. Hide Run Clients from Pre-Intro Questionnaires

**File:** `src/components/PastBookingQuestionnaires.tsx`

The questionnaire links section currently shows all active bookings. Update it to also fetch `intros_run` and exclude any booking whose `member_name` has a completed intro run (result other than 'No-show'). This way, once an intro is actually run for someone, their questionnaire link row disappears -- they no longer need a pre-intro questionnaire.

The Client Pipeline itself remains unchanged and continues to show all pipeline stages as it does today.

---

## File Summary

| Action | File |
|--------|------|
| Edit | `supabase/functions/import-lead/index.ts` -- remove leads logic for Format B |
| Create | `src/pages/Pipeline.tsx` -- new page with 3 components |
| Edit | `src/components/BottomNav.tsx` -- add Pipeline tab |
| Edit | `src/App.tsx` -- add /pipeline route |
| Edit | `src/pages/Recaps.tsx` -- remove 3 moved components |
| Edit | `src/components/PastBookingQuestionnaires.tsx` -- exclude clients with completed runs |

