

# Messaging Template Engine

## Overview

A complete script template system where admins create/edit messaging templates with merge fields, and SAs generate personalized messages contextually from leads, bookings, or a standalone library. Messages are copied to clipboard (no direct sending). Multi-step sequences are tracked per lead/booking.

---

## Part A: Database Schema

### New Tables

**script_templates**
| Column | Type | Notes |
|--------|------|-------|
| id | uuid (PK) | |
| name | text | e.g. "1A: 1st Intro Booking Confirmation" |
| category | text | One of 12 categories |
| channel | text | "sms" or "dm" |
| sequence_order | integer (nullable) | For multi-step sequences |
| body | text | Template with `{first-name}` placeholders |
| timing_note | text (nullable) | e.g. "Send 24-48 hours later" |
| is_shared_step | boolean (default false) | |
| shared_step_id | uuid (nullable, FK to self) | References a shared template |
| is_active | boolean (default true) | |
| variant_label | text (nullable) | e.g. "Price Objection" |
| created_at | timestamptz | |
| updated_at | timestamptz | |

**script_send_log**
| Column | Type | Notes |
|--------|------|-------|
| id | uuid (PK) | |
| template_id | uuid (FK to script_templates) | |
| lead_id | uuid (nullable) | |
| booking_id | uuid (nullable) | |
| sent_by | text | SA name from auth context |
| sent_at | timestamptz | |
| message_body_sent | text | Final message after edits |
| sequence_step_number | integer (nullable) | |

RLS: Public access (matching existing app pattern -- security enforced at app level via AuthContext).

Three seed templates inserted via migration:
1. "1A: 1st Intro Booking Confirmation" (booking_confirmation, sms)
2. "3A: No-Show Initial" (no_show, sms, sequence_order: 1)
3. "4A: IG DM Opener" (ig_dm, dm, sequence_order: 1)

---

## Part B: Navigation

Add a "Scripts" item to `BottomNav.tsx` between "Leads" and "Pipeline" using the `MessageSquare` icon. Route: `/scripts`.

Add the `/scripts` route in `App.tsx` as a protected route.

---

## Part C: New Files

### Pages
- `src/pages/Scripts.tsx` -- Main scripts page with two modes: Admin (manage templates) and SA (browse/generate)

### Components (src/components/scripts/)
- `TemplateCategoryTabs.tsx` -- Tab bar for 12 categories
- `TemplateCard.tsx` -- Card display for a single template (name, channel badge, timing note, active toggle)
- `TemplateEditor.tsx` -- Dialog for creating/editing a template (text area + merge field reference sidebar)
- `MessageGenerator.tsx` -- The core generation dialog: auto-fills merge fields, highlights unfilled ones in orange, editable preview styled as a text bubble, Copy + Log buttons
- `SequenceTracker.tsx` -- Shows which step was sent and what's next (progress indicator)
- `MergeFieldReference.tsx` -- Small panel listing available merge fields with descriptions
- `ScriptPickerSheet.tsx` -- Bottom drawer for contextual script selection (used from leads/bookings)

### Hooks
- `src/hooks/useScriptTemplates.ts` -- React Query hook for fetching/mutating templates
- `src/hooks/useScriptSendLog.ts` -- React Query hook for send log (tracking sequence progress)

---

## Part D: Template Management (Admin Side)

The Scripts page (`/scripts`) shows:
- Category tabs across the top (horizontally scrollable on mobile)
- Search bar
- List of template cards filtered by selected category
- "Add Template" button (admin only)
- Each card shows: name, channel badge (SMS/DM), timing note, sequence order, active/inactive toggle
- Clicking a card opens the TemplateEditor dialog

**TemplateEditor** contains:
- Name input
- Category select (12 options)
- Channel select (SMS/DM)
- Sequence order input (optional)
- Variant label input (optional)
- Timing note input (optional)
- Active toggle
- **Message body textarea** with merge field reference panel below it showing all available fields: `{first-name}`, `{last-name}`, `{sa-name}`, `{day}`, `{time}`, `{today/tomorrow}`, `{questionnaire-link}`, `{friend-questionnaire-link}`, `{location-name}`, `{specific-thing}`, `{x}`
- Shared step toggle -- when enabled, shows notice "This step is shared across N sequences" with list
- Save / Delete buttons

Non-admin users see the template list in read-only mode (no edit/add/delete).

---

## Part E: Contextual Script Access (SA Side)

### Integration 1: Leads Pipeline

In `LeadDetailSheet.tsx`, add a "Send Script" button to the quick actions grid. When tapped, opens `ScriptPickerSheet` filtered by:
- Lead stage "new" -> category "web_lead"
- Lead stage "contacted" -> category "web_lead" (follow-up variants)
- Lead in pipeline > 30 days -> also offer "cold_lead" category
- If lead source contains "Instagram" -> offer "ig_dm" category

Auto-filled merge fields: `{first-name}` from lead.first_name, `{last-name}` from lead.last_name, `{sa-name}` from logged-in user.

### Integration 2: Intro Bookings

In `IntroBookingEntry.tsx`, add a small "Scripts" button. Opens `ScriptPickerSheet` filtered by booking context:
- New booking -> "booking_confirmation" (auto-fills `{questionnaire-link}`, `{day}`, `{time}`)
- Day before class -> "pre_class_reminder"
- Post-class no sale -> "post_class_no_close" with variant dropdown
- Post-class with sale -> "post_class_joined"
- No-show -> "no_show" sequence

Auto-filled merge fields: `{first-name}`, `{last-name}` from member_name, `{sa-name}` from user, `{day}`/`{time}` from class_date/intro_time, `{questionnaire-link}` from questionnaire slug, `{today/tomorrow}` computed.

### Integration 3: DM Sequences

When viewing IG DM scripts, the sequence tracker shows step-by-step progress. After logging step 1, step 2 is highlighted as next. For branching (friend vs no friend), both options are shown with labels.

### Integration 4: Standalone Access

The `/scripts` page itself serves as the standalone library. In standalone mode, all merge fields are manual (shown as orange-highlighted inputs in the generator).

---

## Part F: Message Generation Flow

**MessageGenerator** dialog (the core UX):

1. Shows template name and category at top
2. Preview area styled as a **chat bubble** (rounded corners, light background)
3. Auto-filled merge fields render as normal text
4. Unfilled merge fields render with **orange background highlight** and a text input appears below the preview for each unfilled field
5. The entire message is in an editable textarea so SA can adjust wording
6. Two buttons at bottom:
   - **"Copy to Clipboard"** (primary, orange) -- copies text, shows "Copied!" toast
   - **"Log as Sent"** (secondary, outline) -- records to `script_send_log` with template_id, lead_id/booking_id, sent_by, message body, and sequence step number

---

## Part G: Sequence Tracking

**SequenceTracker** component shown in lead detail and booking detail views:

- Queries `script_send_log` for this lead/booking
- Shows timeline: "Step 1 sent Feb 11 by Grace", "Step 2 sent Feb 13 by Grace"
- Highlights NEXT step with timing suggestion from template's `timing_note`
- Visual progress bar (e.g., step 2 of 4)

**Lead pipeline badge**: In `LeadCard.tsx`, if a lead has a next sequence step due (based on last sent timestamp + timing), show a small `MessageSquare` icon badge.

---

## Part H: Shared Steps

Templates with `is_shared_step = true` serve as canonical versions. Other templates reference them via `shared_step_id`. When rendering a template whose `shared_step_id` is set, the body is pulled from the shared template instead.

In the admin editor, when editing a shared step:
- Query all templates where `shared_step_id = this.id`
- Show warning: "This step is shared across N sequences. Changes will apply to all." with list of sequence names.

---

## File Summary

| Action | File |
|--------|------|
| Migration | Create `script_templates` and `script_send_log` tables with RLS + seed data |
| Create | `src/pages/Scripts.tsx` |
| Create | `src/components/scripts/TemplateCategoryTabs.tsx` |
| Create | `src/components/scripts/TemplateCard.tsx` |
| Create | `src/components/scripts/TemplateEditor.tsx` |
| Create | `src/components/scripts/MessageGenerator.tsx` |
| Create | `src/components/scripts/SequenceTracker.tsx` |
| Create | `src/components/scripts/MergeFieldReference.tsx` |
| Create | `src/components/scripts/ScriptPickerSheet.tsx` |
| Create | `src/hooks/useScriptTemplates.ts` |
| Create | `src/hooks/useScriptSendLog.ts` |
| Edit | `src/components/BottomNav.tsx` -- add Scripts nav item |
| Edit | `src/App.tsx` -- add /scripts route |
| Edit | `src/components/leads/LeadDetailSheet.tsx` -- add Send Script button + ScriptPickerSheet |
| Edit | `src/components/leads/LeadCard.tsx` -- add sequence due badge |
| Edit | `src/components/IntroBookingEntry.tsx` -- add Scripts button |

