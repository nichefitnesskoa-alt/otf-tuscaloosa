

# Keep Completed Intros Visible on Today Tab

## Problem

Line 221 in `useUpcomingIntrosData.ts` filters out any intro that has a linked run for the "today" and "restOfWeek" time ranges:

```ts
: rawItems.filter(i => !i.hasLinkedRun);
```

This means once an outcome is logged (creating an `intros_run` record), the intro disappears from the Today tab. The user wants completed intros to remain visible so outcomes can be reviewed or edited.

## Fix — `src/features/myDay/useUpcomingIntrosData.ts`

**Line 221**: For `today` mode, keep ALL items (don't filter out linked runs). For `restOfWeek`, also keep all items. The filtering only makes sense for `needsOutcome` where the purpose is specifically to surface unresolved intros.

Change lines 212-221 from:
```ts
const activeItems = isNeedsOutcome
  ? rawItems.filter(i => { ... })
  : rawItems.filter(i => !i.hasLinkedRun);
```

To:
```ts
const activeItems = isNeedsOutcome
  ? rawItems.filter(i => { ... })
  : rawItems; // Keep all intros visible on today/restOfWeek for review & edits
```

Also need to remove the `booking_status_canon` exclusion for `PURCHASED` and `CLOSED_PURCHASED` on line 86 when in `today` or `restOfWeek` mode, since those are completed intros that should now be visible. The DB query currently filters them out at the SQL level.

**Line 86**: Make the status exclusion conditional — for `needsOutcome`, keep the current exclusions. For `today`/`restOfWeek`, only exclude `CANCELLED` and `PLANNING_RESCHEDULE` (truly removed bookings), but keep `PURCHASED`, `CLOSED_PURCHASED`, `NOT_INTERESTED`, and `SECOND_INTRO_SCHEDULED` visible.

### Summary of changes

1. **Line 86**: For today/restOfWeek, narrow the exclusion to only `CANCELLED` so completed intros are fetched from the database
2. **Line 221**: Remove the `!i.hasLinkedRun` filter for today/restOfWeek — show all intros regardless of outcome status

One file changed: `src/features/myDay/useUpcomingIntrosData.ts`

