

# Fix: Prevent Auto-Imported Leads from Showing in Leads Pipeline

## Problem

When an online intro email is parsed and POSTed to `import-lead`, the edge function creates both a **lead** (in `leads` table) and a **booking** (in `intros_booked`). The booking correctly appears in the Client Pipeline's "Upcoming" tab. However, the lead also appears in the Leads Pipeline because the `booked_intro_id` field on the lead record is never set.

Your frontend already has the logic to hide booked leads -- the Kanban board, List view, and Metrics bar all filter out leads where `booked_intro_id` is not null. The only missing piece is on the backend.

## Fix (One Change)

**File:** `supabase/functions/import-lead/index.ts`

After the booking is created (or an existing one is found), update the lead record to set:
- `booked_intro_id` = the booking's UUID
- `stage` = `'booked'`

This is a small addition (~5 lines) right after the booking dedupe/creation block (around line 227), before the intake event is recorded.

```text
Current flow:
  Create/find booking -> Record intake event -> Return

Updated flow:
  Create/find booking -> Link booking to lead (set booked_intro_id + stage) -> Record intake event -> Return
```

## What This Fixes

- Leads that come in via the auto-import (Format B) will have `booked_intro_id` set, so they won't appear in the Leads Pipeline
- They will still appear in the Client Pipeline via `intros_booked` as they do now
- No frontend changes needed -- the filtering logic is already in place

## Existing Data

Mary (and any other leads already imported this way) will also need their `booked_intro_id` updated. I'll query for leads created by the auto-import that are missing this link and patch them.

