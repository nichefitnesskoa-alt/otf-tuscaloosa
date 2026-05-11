# Export Team Meeting — Own It Weekly Export

## Confirmed schema

Submissions live in **`table_owner_entries`** (one row per Owner per meeting):
- `last_week_update` → "What happened in your lane last week?"
- `this_week_focus` → "What are you focused on this week?"
- `ideas` → "Any ideas on your mind?"
- `ask` → "What do you need from someone in this room?"
- `submitted_at` (nullable — only "submitted" rows count as submitted)

Owner identity from `table_owners`: `display_name` (name), `lane_name` (lane), `category` (domain).

The week is anchored by `table_meetings.meeting_date` (Monday, America/Chicago) — already resolved by `useCurrentMeeting()`.

The five canonical domains already exist as `LANE_CATEGORIES` in `src/lib/table/laneSuggestions.ts` and match the spec exactly:
1. Content and Brand
2. Member Experience
3. Leads and Growth
4. Coaching and Development
5. Operations and Culture

No domain-name drift found — every Owner's `category` is auto-resolved from `LANE_SUGGESTIONS` against this same list. No cleanup migration needed. Custom lanes have `category = null` and will be grouped under a trailing **"Uncategorized"** bucket so nothing silently disappears.

## What gets built

**1. New helper: `src/lib/table/exportOwnIt.ts`**
- `buildOwnItExport({ meetingDate, owners, entries }) → string`
- Header: `OWN IT — WEEK OF {Monday, Mon DD YYYY in CST}`
- Groups Owners by `category` in the canonical order above (Uncategorized last).
- Within a domain, alphabetical by `display_name`.
- Only includes Owners whose entry has `submitted_at != null` (matches the count badge).
- Each block:
  ```
  ── {Owner Name} — {Lane}
  Submitted: {YYYY-MM-DD HH:mm CST}

  1. What happened in your lane last week?
  {answer or "No response"}

  2. What are you focused on this week?
  {answer or "No response"}

  3. Any ideas on your mind?
  {answer or "No response"}

  4. What do you need from someone in this room?
  {answer or "No response"}
  ```
- Excludes the Architect (Koa) — he's not an Owner in the round.

**2. New component: `src/components/table/ExportTeamMeetingButton.tsx`**
- Reads `useCurrentMeeting`, `useActiveOwners`, `useOwnerEntries`.
- Computes submitted count = entries with `submitted_at != null` whose owner is active + non-architect.
- Renders an OTF-orange button, right-aligned, with a darker-orange pill badge:
  - Enabled: `Export Team Meeting` + pill `X submitted`
  - Disabled (count = 0): `No submissions yet`
- On click, builds the text once and reveals two inline buttons side-by-side: **Copy to clipboard** and **Download .txt** (filename: `own-it-week-of-YYYY-MM-DD.txt`). Both produce identical content. Toast on copy success.

**3. Mount point: `src/pages/TheTable.tsx`**
- Place the button at the top of the submissions view, right-aligned, above the existing Owner grid/carousel. No modal, no route change.

## Out of scope
- No schema changes.
- No edits to existing submission read/display code (domain order already canonical).
- No AI integration — this is a pure export; Koa pastes into Claude himself.

## Files touched
- `src/lib/table/exportOwnIt.ts` (new)
- `src/components/table/ExportTeamMeetingButton.tsx` (new)
- `src/pages/TheTable.tsx` (mount button)
