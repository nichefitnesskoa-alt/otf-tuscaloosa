

# Add Manual Delete and Auto-Delete for Completed Questionnaires

## Overview

Add a delete button on each completed questionnaire row, plus an automatic cleanup that removes completed questionnaires 3 days after the intro was actually run.

## Changes

### 1. `src/components/PastBookingQuestionnaires.tsx` -- Add Delete Button

- Import `Trash2` from lucide-react
- Add a `deleteQuestionnaire` function that:
  - Deletes the record from `intro_questionnaires` by ID
  - Removes it from local state
  - Shows a toast confirmation
- Add a small trash icon button next to each completed questionnaire row (in the Completed tab), styled as a ghost button matching the existing copy/link buttons

### 2. Auto-Delete via Scheduled Cleanup (Edge Function + Cron)

Create an edge function `cleanup-questionnaires` that:
- Queries `intro_questionnaires` where `status = 'completed'`
- Joins against `intros_run` by member name to find questionnaires whose client has a completed intro run
- If the intro run's `created_at` is more than 3 days ago, delete the questionnaire record
- Returns a count of deleted records

Schedule it via `pg_cron` to run once daily.

### 3. Database: No schema changes needed
The existing `intro_questionnaires` table and its RLS delete policy (admin-only) will need to be updated to allow broader delete access, OR the edge function can use the service role key to bypass RLS. For the manual delete button in the UI, we need to add a permissive delete policy (since current policy requires admin role).

**RLS update**: Add a new DELETE policy on `intro_questionnaires` that allows deletion when `status = 'completed'` (so staff can only delete completed ones, not in-progress ones).

## File Summary

| Action | File |
|--------|------|
| Migration | Add permissive DELETE policy on `intro_questionnaires` for completed records |
| Edit | `src/components/PastBookingQuestionnaires.tsx` -- add delete button on completed rows |
| Create | `supabase/functions/cleanup-questionnaires/index.ts` -- auto-delete completed questionnaires 3 days after intro run |
| SQL (insert tool) | Schedule daily cron job for cleanup function |

