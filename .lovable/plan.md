

# Plan: Fix Follow-Ups, Clean IG Leads, Fix Scripts in Pipeline, Fix AI Generate

## Issue 1 — Follow-Ups Not Showing (Root Cause Found)

**Root cause**: The 6-day cooling guardrail in `FollowUpsDueToday.tsx` (line 259) filters out follow-ups when ANY `script_actions` entry exists for that booking in the last 6 days — including `past_text` actions logged via the "Log Past Contact" dialog. Both Mia Leahy and Mariel Peters have `past_text` actions from yesterday, which suppresses their pending Touch 2/3 follow-ups.

**File: `src/components/dashboard/FollowUpsDueToday.tsx`** (line 125)

Change the `recentActionsRes` query to only count outreach-type actions that should trigger cooling, not passive logging:

```typescript
// Was: all script_actions in last 6 days
supabase.from('script_actions').select('booking_id')
  .gte('completed_at', sixDaysAgo + 'T00:00:00')
  .in('action_type', ['script_sent', 'confirmation_sent'])
```

This ensures that logging a past contact (`past_text`) does not suppress the follow-up from appearing.

---

## Issue 2 — Delete All Old IG Leads

**Action**: Run a DELETE on `ig_leads` to remove all 42 records (all have status `not_booked`).

```sql
DELETE FROM ig_leads;
```

---

## Issue 3 — Scripts Not Interactable in Pipeline

**Root cause**: The `PipelineScriptPicker` uses a `Drawer` component rendered inside the `PipelineSpreadsheet` parent. The spreadsheet's scroll container (`h-[600px] overflow-auto`) with `position: relative` on the virtualizer wrapper can trap pointer events or z-index for the Drawer portal. The Drawer overlay may be rendering behind or getting clipped.

**Fix in `src/features/pipeline/PipelinePage.tsx`**: Move the `PipelineScriptPicker` rendering from inside `PipelineSpreadsheet` to the top-level `PipelinePage` component, alongside the other dialogs. This ensures the Drawer portal is not nested inside a scrollable, positioned container.

Steps:
1. In `PipelineSpreadsheet.tsx`: Remove the `scriptJourney` state and the `PipelineScriptPicker` rendering. Instead, accept an `onOpenScript(journey)` callback prop and call it.
2. In `PipelinePage.tsx`: Add `scriptJourney` state, pass the callback to `PipelineSpreadsheet`, and render `PipelineScriptPicker` at the page level alongside `PipelineDialogs`.

---

## Issue 4 — AI Generate Script Not Working

**Root cause**: No edge function logs means the function call may be failing silently or not reaching the server. The `generate-script` edge function uses `ANTHROPIC_API_KEY` directly. The function code and config look correct. Most likely cause: the function needs redeployment or the `VITE_SUPABASE_URL` environment variable isn't resolving correctly in the fetch call.

**Fix**:
1. Redeploy the `generate-script` edge function (touch the file to trigger auto-deploy).
2. In `ScriptPickerSheet.tsx` line 194: Add better error handling and logging so failures surface to the user instead of being swallowed.
3. Change the fetch URL construction to use `VITE_SUPABASE_URL` with a fallback, and add a toast with the actual error message instead of generic "AI generation failed".

---

## Summary of Changes

| File | Change |
|------|--------|
| `src/components/dashboard/FollowUpsDueToday.tsx` | Fix cooling guardrail to only count `script_sent`/`confirmation_sent` actions |
| DB (ig_leads) | Delete all 42 IG lead records |
| `src/features/pipeline/PipelinePage.tsx` | Host `PipelineScriptPicker` at page level |
| `src/features/pipeline/components/PipelineSpreadsheet.tsx` | Lift script state up via callback prop |
| `supabase/functions/generate-script/index.ts` | Touch to redeploy + improve error surface |
| `src/components/scripts/ScriptPickerSheet.tsx` | Better error handling for AI generate |

