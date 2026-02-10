

# Pre-Intro Diagnostic Questionnaire

## Overview

This feature adds a pre-intro questionnaire system with three main parts:
- A new database table to store questionnaire responses
- A public-facing, mobile-first questionnaire page (no login required)
- Staff-side integration showing questionnaire links, status, and responses on intro bookings

---

## Part 1: Database

### New Table: `intro_questionnaires`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid (PK) | The opaque link ID used in the URL |
| booking_id | uuid | Links to `intros_booked.id` |
| client_first_name | text | Pre-filled from booking |
| client_last_name | text | Pre-filled from booking |
| scheduled_class_date | date | From booking |
| scheduled_class_time | time | From booking |
| q1_fitness_goal | text | Nullable until submitted |
| q2_fitness_level | integer | 1-10 |
| q3_obstacle | text | |
| q4_past_experience | text | |
| q5_emotional_driver | text | |
| q6_weekly_commitment | text | |
| q7_coach_notes | text | Nullable (optional question) |
| status | text | 'not_sent', 'sent', 'completed' |
| submitted_at | timestamptz | Null until submitted |
| created_at | timestamptz | Default now() |

### RLS Policies

- **SELECT**: Public (anyone with the UUID can load it) -- `true`
- **INSERT**: Authenticated staff only -- `auth.uid() IS NOT NULL`
- **UPDATE**: Public (so prospects can submit without login) -- `true`
- **DELETE**: Admin only

This is safe because:
- The UUID is unguessable (256-bit random)
- UPDATE only fills in answer fields; the app logic controls what gets written
- No sensitive data is exposed beyond what the prospect themselves entered

---

## Part 2: Auto-Generate Questionnaire Link on Booking

### Changes to `IntroBookingEntry.tsx`

When the SA fills in the member name and intro date (minimum required fields), the component will:

1. Insert a row into `intro_questionnaires` with the client info and status `not_sent`
2. Display the generated link below the booking entry
3. Show a **Copy Link** button that copies to clipboard and updates status to `sent`
4. Show a status badge: "Not Sent" (gray), "Sent" (yellow), "Completed" (green)

The link format will be:
```
https://otf-tuscaloosa-shift-recap.lovable.app/questionnaire/{uuid}
```

The questionnaire row is created eagerly (before shift recap submission) so the link is available immediately. On shift recap submission, the booking's database ID will be linked back to the questionnaire record.

### New field in `IntroBookingData` interface:
```typescript
questionnaireId?: string;
questionnaireStatus?: 'not_sent' | 'sent' | 'completed';
```

---

## Part 3: Public Questionnaire Page

### New Route: `/questionnaire/:id`

This route is **outside** the `ProtectedRoute` wrapper -- no login required.

### New Page: `src/pages/Questionnaire.tsx`

A standalone, mobile-first, multi-step form with:

- **OTF logo** at top (the uploaded image will be copied to `src/assets/otf-logo.jpg`)
- **White background**, OTF orange (#FF6900) accents, dark gray (#333333) text
- **Progress bar** at top showing completion (7 steps)
- **One question per screen** with smooth framer-motion slide transitions
- **Welcome screen** with pre-filled name and class date/time
- **7 questions** in exact order specified
- **Completion screen** with "Add to Calendar" button (generates .ics download)

### Question Components

Each question type gets a reusable sub-component:

| Question | Component Type |
|----------|---------------|
| Q1 (Goal) | Single-select cards + "Other" text field |
| Q2 (Level) | Tappable number buttons 1-10 with labels |
| Q3 (Obstacle) | Single-select cards + "Other" text field |
| Q4 (Past experience) | Text input (required) |
| Q5 (Emotional driver) | Text input (required) |
| Q6 (Commitment) | 3 tappable buttons |
| Q7 (Coach notes) | Textarea (optional, marked as such) |

### Behavior
- On page load: fetch the questionnaire row by UUID
- If `status === 'completed'`: show "Already submitted" message
- If not found: show "Invalid link" message
- Inline validation: can't proceed without answering required questions
- On submit: UPDATE the row with all answers, set `status = 'completed'`, `submitted_at = now()`

---

## Part 4: Staff-Side Response Viewer

### New Component: `src/components/QuestionnaireResponseViewer.tsx`

Shown inside `IntroBookingEntry` when a questionnaire exists and has been completed.

- **"View Responses" button** that expands/collapses the response panel
- **Quick-View Summary Card** at top with orange-left-border styling:

```text
  GOAL:          [Q1 answer]
  LEVEL:         [Q2]/10
  OBSTACLE:      [Q3 answer]
  EMOTIONAL WHY: [First ~80 chars of Q5]
```

- **Full responses** listed below with question labels

### Integration with IntroRunEntry

When an intro run is linked to a booking that has a completed questionnaire, the questionnaire data is automatically available. No extra linking needed -- the `booking_id` foreign key connects them.

---

## Part 5: New Component: `src/components/QuestionnaireLink.tsx`

A small component shown below each intro booking entry that handles:
- Creating the questionnaire record when booking has name + date
- Displaying the link
- Copy-to-clipboard button
- Status badge (Not Sent / Sent / Completed)
- Polling or checking for completion status

---

## File Summary

### New Files
| File | Purpose |
|------|---------|
| `src/assets/otf-logo.jpg` | OTF logo copied from upload |
| `src/pages/Questionnaire.tsx` | Public-facing multi-step questionnaire form |
| `src/components/QuestionnaireLink.tsx` | Link generator + copy + status for booking entries |
| `src/components/QuestionnaireResponseViewer.tsx` | Staff-side response viewer with summary card |

### Modified Files
| File | Change |
|------|--------|
| `src/App.tsx` | Add `/questionnaire/:id` route (unprotected) |
| `src/components/IntroBookingEntry.tsx` | Add `questionnaireId`/`questionnaireStatus` to interface; render `QuestionnaireLink` and `QuestionnaireResponseViewer` |
| `src/pages/ShiftRecap.tsx` | Pass through questionnaire fields; link `booking_id` after insert |

### Database Migration
| Change | Details |
|--------|---------|
| Create `intro_questionnaires` table | Schema as described above |
| RLS policies | Public SELECT/UPDATE, authenticated INSERT, admin DELETE |

---

## Technical Notes

- The questionnaire UUID is generated client-side via `crypto.randomUUID()` and inserted into the database immediately -- no need for a server round-trip to generate the link
- The public form uses the Supabase anon key (already configured) for the UPDATE call
- framer-motion (already installed) handles slide transitions between questions
- The "Add to Calendar" button generates a `.ics` file download with the class datetime and studio info
- The questionnaire record is created in the database before the shift recap is submitted, so the link is available right away. When the shift recap is submitted and the `intros_booked` row is created, the questionnaire's `booking_id` is updated to point to the new booking's actual database ID

