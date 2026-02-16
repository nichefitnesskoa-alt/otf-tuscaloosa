

## Build: Team Meeting Feature -- Auto-Generated Weekly Agenda with Presentable View

### Overview
A new "Team Meeting" feature that auto-generates a Monday meeting agenda from the app's existing data. It lives at `/meeting` (presentable view for all users) and has prep/edit capabilities for Admins. Every team member can view the read-only agenda; Admins can edit manual shoutouts, housekeeping, and override the drill recommendation.

---

### Database Changes

**New table: `meeting_agendas`**

| Column | Type | Notes |
|---|---|---|
| id | uuid (PK) | gen_random_uuid() |
| meeting_date | date | NOT NULL, the Monday date |
| date_range_start | date | NOT NULL, previous Monday |
| date_range_end | date | NOT NULL, Sunday before meeting |
| metrics_snapshot | jsonb | All auto-calculated metrics at generation time |
| manual_shoutouts | text | Nullable, SL-editable |
| housekeeping_notes | text | Nullable, SL-editable |
| wig_commitments | text | Nullable, editable during/after meeting |
| wig_target | text | Nullable, e.g. "45% close rate" |
| drill_override | text | Nullable, SL override of auto-suggested drill |
| status | text | DEFAULT 'draft' (draft / presented / archived) |
| created_at | timestamptz | DEFAULT now() |
| updated_at | timestamptz | DEFAULT now() |

RLS: Public SELECT (all authenticated staff can view). INSERT/UPDATE/DELETE restricted to admins via application-level checks (matching existing pattern of public RLS + app-level role enforcement).

**New table: `meeting_settings`** (single-row config)

| Column | Type | Notes |
|---|---|---|
| id | uuid (PK) | gen_random_uuid() |
| meeting_day | integer | DEFAULT 1 (Monday = 1) |
| meeting_time | text | DEFAULT '10:00 AM' |
| created_at | timestamptz | DEFAULT now() |

RLS: Public SELECT, admin-only UPDATE.

---

### New Files

**1. `src/pages/Meeting.tsx`** -- The main meeting page

- Accepts a `?mode=present` query param to toggle present mode
- **Default (prep) mode** (Admin only): shows all sections with edit fields, "Present" toggle button, "Regenerate" button, meeting navigation arrows
- **Present mode** (everyone): clean, large-font, dark or white background, no edit controls. Sections advance with Next/Prev buttons or arrow keys. Side panel for section jumping.
- **SA/Coach view**: always sees present mode (read-only). No edit controls visible.
- Fetches or auto-generates the agenda for the current meeting week
- Shows "Monday's Meeting Agenda -- Generated Sunday at 3:00 PM" header for SA view

**2. `src/hooks/useMeetingAgenda.ts`** -- Data fetching and auto-generation hook

- `useMeetingAgenda(meetingDate?)`: fetches agenda for a given Monday or current Monday
- `useGenerateAgenda()`: mutation that computes all metrics from existing tables and upserts into `meeting_agendas`
- Metric calculations reuse the same logic as Studio Scoreboard and Coaching:
  - Close Rate = Sales / Showed (same query as StudioScoreboard)
  - Show Rate = Showed / Booked
  - Booking-to-Sale = Sales / Booked
  - Lead source breakdown from `intros_booked`
  - Objection breakdown from `intros_run` (primary_objection field)
  - Follow-up completion from `follow_up_queue`
  - Q completion from `intro_questionnaires`
  - AMC from latest `amc_log` entry
  - Outreach totals from `shift_recaps` (calls, texts, DMs, emails)
  - Speed-to-lead from `script_actions` + `leads` (time between lead creation and first_contact action)

**3. `src/components/meeting/MeetingSection.tsx`** -- Reusable section wrapper

- Props: title, icon, children, sectionId
- In present mode: fills viewport, large fonts
- In prep mode: card-based, with edit controls

**4. `src/components/meeting/ShoutoutsSection.tsx`**

- Auto-generates 3-5 shoutouts from weekly data (top closer, most sales, best show rate, follow-up machine, outreach leader, prep master)
- Merges with manual shoutouts (indistinguishable in present mode)
- Admin prep view shows editable textarea for manual shoutouts

**5. `src/components/meeting/ScoreboardSection.tsx`**

- Large-format metrics display: AMC, Sales, Close Rate as hero row
- Pipeline row: Booked --> Showed --> Sold with percentages
- Lead measures row: Q Completion, Follow-Up Completion, Speed-to-Lead
- Lead generation row: new leads by source
- Green/red trend arrows comparing to previous week
- "Biggest Opportunity" auto-generated callout

**6. `src/components/meeting/ObjectionSection.tsx`**

- Breakdown of objections from `intros_run.primary_objection` for the date range
- Highlights top objection with drill recommendation

**7. `src/components/meeting/DrillSection.tsx`**

- Pulls EIRMA content from `objection_playbooks` table for the recommended objection
- Shows E-I-R-M-A quick reference
- Drill format instructions
- Admin can override via dropdown

**8. `src/components/meeting/WeekAheadSection.tsx`**

- Forward-looking: intros booked next week (by day), follow-ups due, leads in pipeline
- VIP events from `vip_sessions`
- Editable "events/promotions" field for SL

**9. `src/components/meeting/HousekeepingSection.tsx`**

- Editable text area (admin only), displayed as numbered list
- Hidden in present mode if empty

**10. `src/components/meeting/WigSection.tsx`**

- Placeholder for Alex's WIG session
- Shows current close rate vs target
- Editable commitments text area
- Previous week's commitments shown at top if they exist

---

### Routing Changes (in `src/App.tsx`)

- Add `/meeting` route: accessible to ALL authenticated users (wrapped in ProtectedRoute)
- The page itself handles role-based rendering (Admin sees prep mode, others see present mode)

---

### Admin Integration

- Add a "Team Meeting" card in Admin Overview tab with next meeting date and "Open Meeting Prep" link
- Card shows: "Next: Monday, Feb 23" with status badge (Draft/Ready/Presented)

---

### My Day Integration

- On Mondays (detected by `new Date().getDay() === 1`), render a prominent card at the top of My Day (above Day Score) for ALL users:
  - "Team Meeting Today" with meeting time if configured
  - "View Agenda" button linking to `/meeting`
  - Dismissible (stored in sessionStorage so it only dismisses for the current session)
  - Disappears after midnight Monday

---

### Present Mode Behavior

- Toggle via "Present" button (Admin only) or auto-detected for non-admin users
- Keyboard navigation: ArrowRight/ArrowDown = next section, ArrowLeft/ArrowUp = previous
- Section sidebar (small icons on left edge) for direct jumping
- Font scaling: headings 32px+, body 20px+, hero metrics 48px+
- Dark background with white text for TV readability
- Each section fills viewport height with centered content
- ESC key exits present mode (Admin only)

---

### Auto-Generation Logic

The agenda auto-generates when an admin opens the meeting page and no agenda exists for the current Monday, or when the SL taps "Regenerate." The date range is always previous Monday through Sunday (7 days). The metrics_snapshot JSONB stores all computed values so historical meetings preserve their data even as underlying records change.

Shoutout selection algorithm:
1. Query all intros_run for the date range, group by sa_name/intro_owner
2. Calculate per-SA: close rate (with min 2 intros), raw sales count, show rate
3. Query follow_up_queue for completion rates per SA
4. Query shift_recaps for outreach totals per SA
5. Rank each category, pick top 3-5 non-overlapping SAs (avoid same person winning every category)

---

### Technical Details

| Aspect | Approach |
|---|---|
| Metric consistency | Reuse the same filtering/calculation logic from Recaps.tsx and StudioScoreboard |
| AMC value | Query `amc_log` ORDER BY created_at DESC LIMIT 1 (same as AmcTracker) |
| Objection data | Query `intros_run.primary_objection` for the date range |
| EIRMA content | Query `objection_playbooks` table by objection name |
| Meeting history | Previous/Next arrows query `meeting_agendas` ordered by meeting_date |
| Keyboard nav | useEffect with keydown listener in present mode |
| Role detection | `useAuth()` hook, check `user.role === 'Admin'` |

---

### Files Summary

| File | Action |
|---|---|
| `src/pages/Meeting.tsx` | Create -- main meeting page with prep/present modes |
| `src/hooks/useMeetingAgenda.ts` | Create -- data fetching, generation, and mutation hooks |
| `src/components/meeting/ShoutoutsSection.tsx` | Create |
| `src/components/meeting/ScoreboardSection.tsx` | Create |
| `src/components/meeting/ObjectionSection.tsx` | Create |
| `src/components/meeting/DrillSection.tsx` | Create |
| `src/components/meeting/WeekAheadSection.tsx` | Create |
| `src/components/meeting/HousekeepingSection.tsx` | Create |
| `src/components/meeting/WigSection.tsx` | Create |
| `src/components/meeting/MeetingSection.tsx` | Create -- reusable section wrapper |
| `src/App.tsx` | Edit -- add `/meeting` route |
| `src/pages/Admin.tsx` | Edit -- add Team Meeting card in Overview tab |
| `src/pages/MyDay.tsx` | Edit -- add Monday meeting card at top |
| Database migration | Create `meeting_agendas` and `meeting_settings` tables with RLS |

