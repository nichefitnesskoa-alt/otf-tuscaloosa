

# VIP Scheduler System — Full Build Plan

## Summary

Extend the existing VIP system with a public slot-booking workflow: admins create available time slots, groups claim them via a public URL, and reserved sessions appear in the Intros day view. Four parts: database migration, Pipeline Scheduler tab, public availability page, and Intros tab VIP cards.

---

## Database Migration

Add columns to `vip_sessions` (existing table):

```sql
ALTER TABLE public.vip_sessions
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'open',
  ADD COLUMN IF NOT EXISTS reserved_by_group text,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS is_on_availability_page boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS shareable_slug text UNIQUE,
  ADD COLUMN IF NOT EXISTS created_by text NOT NULL DEFAULT 'system',
  ADD COLUMN IF NOT EXISTS reserved_contact_name text,
  ADD COLUMN IF NOT EXISTS reserved_contact_email text,
  ADD COLUMN IF NOT EXISTS reserved_contact_phone text,
  ADD COLUMN IF NOT EXISTS estimated_group_size integer;
```

Make `session_date` and `session_time` NOT NULL (they currently allow nulls — existing rows may need a default):

```sql
UPDATE public.vip_sessions SET session_date = CURRENT_DATE WHERE session_date IS NULL;
UPDATE public.vip_sessions SET session_time = '09:00' WHERE session_time IS NULL;
ALTER TABLE public.vip_sessions ALTER COLUMN session_date SET NOT NULL;
ALTER TABLE public.vip_sessions ALTER COLUMN session_time SET NOT NULL;
```

Enable Realtime on `vip_sessions`:

```sql
ALTER PUBLICATION supabase_realtime ADD TABLE public.vip_sessions;
```

RLS: Table already has public CRUD policies — sufficient for the public availability page.

---

## Part 1 — VIP Scheduler Tab in Pipeline

**Files:**

- **New: `src/features/pipeline/components/VipSchedulerTab.tsx`** — Full scheduler component.
  - Fetches all `vip_sessions` ordered by `session_date, session_time`.
  - Shows "+ Add Available Slot" button (orange) top-right.
  - Each row: date, time, status badge (green Open / amber Reserved — [group] / red Cancelled), registration count for reserved slots.
  - Actions per row: "Copy Availability Link" (copies `/vip-availability`), "View Registrations" (fetches `vip_registrations` for that session), "Cancel" (sets status=cancelled), "Reset to Open" (for reserved slots — clears `reserved_by_group` and sets status=open).
  - Add Slot modal: Date picker, ClassTimeSelect, Description textarea, "Show on public page" toggle. On save: inserts `vip_sessions` with status=open, auto-generates `shareable_slug` (e.g. `vip-apr19-630am`).

- **Modified: `src/features/pipeline/pipelineTypes.ts`** — Add `'vip_scheduler'` to `JourneyTab` union.

- **Modified: `src/features/pipeline/components/PipelineFiltersBar.tsx`** — Add "Scheduler" tab trigger with CalendarPlus icon after the VIP tab.

- **Modified: `src/features/pipeline/PipelinePage.tsx`** — Import VipSchedulerTab. Render it when `activeTab === 'vip_scheduler'`.

- **Modified: `src/features/pipeline/selectors.ts`** — Add `vip_scheduler: 0` to tab counts default.

---

## Part 2 — Public Availability Page

**Files:**

- **New: `src/pages/VipAvailability.tsx`** — Fully public, no auth required.
  - OTF branded (orange `#FF6900`, logo from `@/assets/otf-logo.jpg`).
  - Header: "OTF Tuscaloosa — Private Group Classes" with subtitle.
  - Fetches `vip_sessions` where `is_on_availability_page = true` AND `session_date >= today` AND `status != 'cancelled'`, ordered by date.
  - Open slots: green "Available" badge + "Claim This Slot" orange button.
  - Reserved slots: amber "Reserved by [group]" badge, muted background, no action.
  - Cancelled: hidden.
  - Realtime subscription on `vip_sessions` — auto-updates when slots change.
  - Claim form (inline, expands below slot): name, group name, email, phone, estimated group size. All required, validated with zod.
  - On submit: updates `vip_sessions` (status=reserved, reserved_by_group, contact fields, estimated_group_size). Also inserts `vip_registrations` row. Inserts notification for all staff. Shows confirmation message.
  - Race condition guard: re-fetch slot status before writing. If already reserved, show "This slot was just claimed. Please choose another."

- **Modified: `src/App.tsx`** — Add public route `<Route path="/vip-availability" element={<VipAvailability />} />`.

---

## Part 3 — Notification on Claim

Uses existing `notifications` table. On claim submit, insert:

```ts
await supabase.from('notifications').insert({
  notification_type: 'vip_slot_claimed',
  title: `${groupName} claimed VIP slot`,
  body: `${groupName} claimed the ${formattedDate} ${formattedTime} VIP slot. ${estimatedSize} estimated attendees. Contact: ${contactName}`,
  target_user: null, // null = visible to all staff
  meta: { session_id, group_name, contact_name, contact_email, contact_phone, estimated_size }
});
```

---

## Part 4 — VIP Sessions in Intros Tab (My Day + Coach View)

**Modified: `src/features/myDay/useUpcomingIntrosData.ts`**
- After fetching regular intros, also fetch `vip_sessions` where `status = 'reserved'` and `session_date` falls within the date range.
- For each reserved session, fetch registration count from `vip_registrations`.
- Map these to `UpcomingIntroItem` with a special `isVipSession: true` flag and relevant fields.

**Modified: `src/features/myDay/myDayTypes.ts`**
- Add optional VIP session fields to `UpcomingIntroItem`: `isVipSession`, `vipGroupName`, `vipEstimatedSize`, `vipRegisteredCount`, `vipContactName`, `vipContactPhone`, `vipSessionId`.

**Modified: `src/features/myDay/IntroRowCard.tsx`**
- When `item.isVipSession === true`, render a distinct VIP session card:
  - Orange "VIP" badge, group name, time, registered count, estimated size.
  - Expanded view: contact name + tappable phone, link to Pipeline VIP registrations.
  - No questionnaire fields, no shoutout bar, no debrief.

---

## What Does NOT Change

- Existing VIP registration page (`/vip-register`)
- Questionnaire flow
- Follow-up queue logic
- Pipeline spreadsheet or other tabs
- WIG page
- Any other page or component not listed above

