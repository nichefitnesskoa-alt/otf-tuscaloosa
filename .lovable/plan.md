

# Plan: Add Script/Text Send Log to Pipeline Cards

## Overview
Fetch `script_actions` data per booking and display touch counts, last contact timestamps, and detailed send history in pipeline rows and expanded cards.

## Changes

### 1. Add type — `src/features/pipeline/pipelineTypes.ts`
Add `PipelineScriptAction` interface:
```typescript
export interface PipelineScriptAction {
  id: string;
  booking_id: string | null;
  lead_id: string | null;
  action_type: string;
  script_category: string | null;
  completed_at: string;
  completed_by: string;
}
```

### 2. Fetch script_actions — `src/features/pipeline/usePipelineData.ts`
- Add `scriptActions` state: `Map<string, PipelineScriptAction[]>` keyed by booking_id
- Fetch from `script_actions` table in parallel with bookings/runs (select `id, booking_id, lead_id, action_type, script_category, completed_at, completed_by`)
- Build the map in a `useCallback`, group by `booking_id`
- Return `scriptActionsMap` from the hook

### 3. Pass through — `src/features/pipeline/PipelinePage.tsx`
- Pass `pipeline.scriptActionsMap` to `PipelineSpreadsheet` as new prop `scriptActionsMap`

### 4. Display in spreadsheet — `src/features/pipeline/components/PipelineSpreadsheet.tsx`

**Props**: Add `scriptActionsMap: Map<string, PipelineScriptAction[]>` to `PipelineSpreadsheetProps`

**Touch column** (currently renders `—`): Look up all booking IDs for the journey in the map, sum action counts, display as badge like `3 texts`

**Last Contact column** (currently renders `—`): Find the most recent `completed_at` across all the journey's bookings' actions, display as relative time (`2d ago`)

**Expanded row detail**: Add a "Outreach Log" section below the Runs section showing each script_action as a row:
```
📤 script_sent · Confirmation · by Bre · 2 days ago
📤 script_sent · Follow-up · by James · 5 days ago
```
Each row shows: action_type icon, script_category, completed_by, relative timestamp. Sorted most recent first. If no actions exist, show "No outreach logged yet" in muted text.

### 5. Column definitions
Add `touch` and `last_contact` columns to the `all` tab column list (currently only on `no_show` tab), and also add to `upcoming`, `completed`, `missed_guest`, and `not_interested` tabs so the send count is visible everywhere.

## Files Changed

| File | Change |
|------|--------|
| `src/features/pipeline/pipelineTypes.ts` | Add `PipelineScriptAction` type |
| `src/features/pipeline/usePipelineData.ts` | Fetch `script_actions`, build map, return it |
| `src/features/pipeline/PipelinePage.tsx` | Pass `scriptActionsMap` prop |
| `src/features/pipeline/components/PipelineSpreadsheet.tsx` | Accept prop, populate touch/last_contact cells, add outreach log in expanded view |

