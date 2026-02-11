

# Leads Pipeline Feature

## Overview

A new "Leads" section in the app for managing pre-intro leads. Leads come in via API (Power Automate) or manual entry, get worked by SAs through New -> Contacted -> Lost/Booked stages, and hand off to the existing intro booking pipeline when booked.

## New Database Tables

### `leads` table
| Column | Type | Notes |
|--------|------|-------|
| id | UUID | Primary key, default gen_random_uuid() |
| first_name | text | Required |
| last_name | text | Required |
| email | text | Nullable |
| phone | text | Required |
| stage | text | 'new', 'contacted', 'lost' (default 'new') |
| source | text | Default 'Manual Entry' |
| lost_reason | text | Nullable |
| follow_up_at | timestamptz | Nullable |
| booked_intro_id | UUID | Nullable, set when lead is booked |
| created_at | timestamptz | Default now() |
| updated_at | timestamptz | Default now() |

RLS: Open read/insert/update/delete for authenticated users (matching existing app pattern -- this app uses name-based auth without Supabase Auth, so policies use `true`).

### `lead_activities` table
| Column | Type | Notes |
|--------|------|-------|
| id | UUID | Primary key |
| lead_id | UUID | FK to leads.id, ON DELETE CASCADE |
| activity_type | text | 'call', 'text', 'note', 'reminder', 'stage_change', 'duplicate_detected' |
| performed_by | text | SA name |
| notes | text | Nullable |
| created_at | timestamptz | Default now() |

Same RLS pattern. Add `updated_at` trigger on leads table.

## New Edge Function: `import-lead`

**File:** `supabase/functions/import-lead/index.ts`

- Public endpoint (verify_jwt = false)
- Validates `x-api-key` header against a `LEADS_API_KEY` secret
- Accepts POST with `{ first_name, last_name, email, phone, source? }`
- Duplicate detection: checks existing leads by email OR phone
  - If duplicate found: adds a "duplicate_detected" activity to existing lead, returns 200
  - If new: inserts lead with stage 'new', returns 201
- Returns 400 for missing fields, 401 for bad API key

A new secret `LEADS_API_KEY` will be requested from the admin.

## New Page: `src/pages/Leads.tsx`

Top-level page accessible from bottom nav. Contains:

### Metrics Bar (top)
Five stat cards in a horizontal scroll: New count, In Progress count, Booked This Week, Lost This Week, Overdue Follow-ups (red if > 0), Conversion Rate (30-day rolling).

### View Toggle (Kanban / List)
Icon toggle in top-right corner.

### Kanban View
Three columns: New, Contacted, Lost. Each lead rendered as a compact card showing:
- Name, phone (tappable tel: link)
- Time since created (relative, e.g., "2h ago")
- Contact attempts badge
- Red border/dot if follow-up is overdue
- Pulse animation or "NEW" badge if < 1 hour old
- Lost cards at reduced opacity

Drag-and-drop between columns using HTML5 drag events (no extra library needed for simple 3-column DnD).

### List View
Table with sortable columns: Name, Phone, Email, Stage (inline dropdown), Date Received, Last Action, Days Since Contact, Attempts. Clicking a row opens detail view.

### Add Lead Button
Opens a dialog/sheet with form: first name, last name, phone, email (optional), notes. Creates lead in 'new' stage with source 'Manual Entry'.

## Lead Detail View: `src/components/leads/LeadDetailSheet.tsx`

Opens as a bottom sheet (Drawer on mobile). Contains:

**Header:** Name, phone (tel: link), email (mailto: link), stage badge, source, date received.

**Quick Actions (row of buttons):**
- Log Call -- optional notes, auto-moves New -> Contacted
- Log Text -- optional notes, auto-moves New -> Contacted
- Add Notes -- general note
- Set Follow-Up -- date/time picker, creates reminder activity
- Book Intro -- prompts for class date/time, creates intros_booked record, sets lead stage to 'booked' and booked_intro_id
- Mark Lost -- dropdown for reason, moves to Lost

**Activity Timeline:** Reverse-chronological list of all activities for this lead.

## Supporting Components

- `src/components/leads/LeadCard.tsx` -- Kanban card
- `src/components/leads/LeadMetricsBar.tsx` -- Top metrics
- `src/components/leads/AddLeadDialog.tsx` -- Manual entry form
- `src/components/leads/LeadKanbanBoard.tsx` -- Kanban layout with DnD
- `src/components/leads/LeadListView.tsx` -- Table view
- `src/components/leads/LogActionDialog.tsx` -- Dialog for logging calls/texts/notes
- `src/components/leads/MarkLostDialog.tsx` -- Lost reason selection
- `src/components/leads/BookIntroDialog.tsx` -- Book into intro pipeline
- `src/components/leads/ScheduleFollowUpDialog.tsx` -- Follow-up picker

## Navigation Changes

### `src/components/BottomNav.tsx`
Add a "Leads" nav item (using `Users` icon from lucide) between "Recap" and "My Shifts":
```text
Recap | Leads | My Shifts | My Stats | Studio | (Admin)
```

### `src/App.tsx`
Add `/leads` route as a protected route pointing to the new Leads page.

## Data Flow

### Book Intro Handoff
When "Book Intro" is tapped on a lead:
1. Create a new `intros_booked` record with the lead's name, class date/time, lead_source set to the lead's source, and sa_working_shift set to current user
2. Update the lead's `stage` to a special value (we'll use the existing 3 stages + track via `booked_intro_id` being non-null) and set `booked_intro_id`
3. The lead disappears from active pipeline views (filtered out when booked_intro_id is set)
4. Log a stage_change activity

### Auto-Stage Advancement
When logging a Call or Text on a lead in 'new' stage, automatically update stage to 'contacted' and log a stage_change activity.

## Secret Setup

Before building the edge function, I'll request a `LEADS_API_KEY` secret. You can set this to any random string -- it's the key you'll paste into Power Automate's HTTP action headers as `x-api-key`.

## File Summary

| Action | File |
|--------|------|
| Create | `src/pages/Leads.tsx` |
| Create | `src/components/leads/LeadCard.tsx` |
| Create | `src/components/leads/LeadDetailSheet.tsx` |
| Create | `src/components/leads/LeadMetricsBar.tsx` |
| Create | `src/components/leads/AddLeadDialog.tsx` |
| Create | `src/components/leads/LeadKanbanBoard.tsx` |
| Create | `src/components/leads/LeadListView.tsx` |
| Create | `src/components/leads/LogActionDialog.tsx` |
| Create | `src/components/leads/MarkLostDialog.tsx` |
| Create | `src/components/leads/BookIntroDialog.tsx` |
| Create | `src/components/leads/ScheduleFollowUpDialog.tsx` |
| Create | `supabase/functions/import-lead/index.ts` |
| Modify | `src/components/BottomNav.tsx` (add Leads nav item) |
| Modify | `src/App.tsx` (add /leads route) |
| Migration | Create `leads` and `lead_activities` tables with RLS |
| Secret | `LEADS_API_KEY` |

