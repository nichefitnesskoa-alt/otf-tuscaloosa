

# Two Changes: Close Rate Color Thresholds + Pre-populate Outcome Data

## 1. Close Rate Color Coding in Studio Scoreboard

**Current behavior**: Close Rate text is always `text-success` (green) regardless of value.

**Desired behavior**:
- 40%+ → Green
- 30-39% → Yellow
- Below 30% → Red

### Change — `src/components/dashboard/StudioScoreboard.tsx`

**Line 80**: Replace the hardcoded `text-success` class on the Close Rate value with a dynamic color based on thresholds:

```ts
const closeRateColor = closingRate >= 40 ? 'text-success' : closingRate >= 30 ? 'text-warning' : 'text-destructive';
```

Apply the same logic to the Close Rate icon on line 79.

Also apply this to `PersonalScoreboard.tsx` (line 77-78) and `ScoreboardSection.tsx` for consistency across all scoreboard views.

### Files
- `src/components/dashboard/StudioScoreboard.tsx` — dynamic close rate color
- `src/components/dashboard/PersonalScoreboard.tsx` — same treatment
- `src/components/meeting/ScoreboardSection.tsx` — same treatment
- `src/lib/studio-metrics.ts` — add `CLOSE_RATE_THRESHOLDS = { green: 40, amber: 30 }` for reuse

---

## 2. Pre-populate Outcome Drawer with Existing Run Data

**Current behavior**: When reopening the outcome drawer for a completed intro, only `currentResult` (the outcome label) is passed. The `existingRunId` is hardcoded to `null` (line 373 of IntroRowCard). Coach name, objection, and notes are all blank — requiring re-entry.

**Desired behavior**: When an existing run exists, load its full data (run ID, coach, objection, notes) so the drawer opens pre-filled for easy review and editing.

### Changes

**`src/features/myDay/useUpcomingIntrosData.ts`**:
- Expand the `intros_run` select query (line 115) to also fetch `id, coach_name, primary_objection, notes`:
  ```ts
  .select('id, linked_intro_booked_id, result, created_at, coach_name, primary_objection, notes')
  ```
- Expand `runMap` to store these additional fields
- Add `latestRunId`, `latestRunCoach`, `latestRunObjection`, `latestRunNotes` to the item mapping

**`src/features/myDay/myDayTypes.ts`**:
- Add to `UpcomingIntroItem`:
  ```ts
  latestRunId: string | null;
  latestRunCoach: string | null;
  latestRunObjection: string | null;
  latestRunNotes: string | null;
  ```

**`src/features/myDay/IntroRowCard.tsx`**:
- Line 373: Pass `existingRunId={item.latestRunId}` instead of `null`

**`src/components/myday/OutcomeDrawer.tsx`**:
- Add props: `initialCoach`, `initialObjection`, `initialNotes`
- Initialize state from these props:
  ```ts
  const [coachName, setCoachName] = useState(initialCoach || '');
  const [objection, setObjection] = useState(initialObjection || '');
  const [notes, setNotes] = useState(initialNotes || '');
  ```

**`src/features/myDay/IntroRowCard.tsx`**:
- Pass the new props from item data:
  ```tsx
  initialCoach={item.latestRunCoach || ''}
  initialObjection={item.latestRunObjection || ''}
  initialNotes={item.latestRunNotes || ''}
  ```

### Files
| File | Change |
|------|--------|
| `src/lib/studio-metrics.ts` | Add `CLOSE_RATE_THRESHOLDS` |
| `src/components/dashboard/StudioScoreboard.tsx` | Dynamic close rate color |
| `src/components/dashboard/PersonalScoreboard.tsx` | Dynamic close rate color |
| `src/components/meeting/ScoreboardSection.tsx` | Dynamic close rate color |
| `src/features/myDay/myDayTypes.ts` | Add run detail fields to UpcomingIntroItem |
| `src/features/myDay/useUpcomingIntrosData.ts` | Fetch & map run ID, coach, objection, notes |
| `src/features/myDay/IntroRowCard.tsx` | Pass existing run data to OutcomeDrawer |
| `src/components/myday/OutcomeDrawer.tsx` | Accept & use initial run data props |

