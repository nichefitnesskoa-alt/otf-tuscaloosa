## Changes

### 1. `src/components/shared/WeekDayTabs.tsx` — full-width day pills
Change the day tab row from a horizontal-scroll flex into an equal-width 7-column grid that fills the container.

- Replace `flex gap-1.5 overflow-x-auto pb-1` with `grid grid-cols-7 gap-1.5`.
- Drop `min-w-[52px]` from each pill (grid column already sets width); keep `min-h-[44px]` and centering. Each day will stretch to fill its column edge-to-edge.

No logic/data changes — purely layout.

### 2. `src/features/myDay/UpcomingIntrosCard.tsx` — remove Q summary bar
Delete the block at lines ~382–393 that renders:
> "Today: 3 intros · 0 questionnaires sent · 1 still needed"

(the `isWeekFullView && qSummary && qSummary.total > 0` div). Also drop the now-unused `qSummary` and `selectedDayLabel` memos.

### 3. `src/features/myDay/IntroDayGroup.tsx` — remove the day-group header bar + bulk send
Inside the day group, remove:
- The header strip `<div className="flex items-center justify-between gap-2 bg-muted/40 rounded-lg px-3 py-1.5">…</div>` that shows "Today · 3 intros · Q: 0%".
- The `<BulkActionsBar … />` row directly below it (the "Send 1 Q" button).

Keep the time-block collapsibles intact — they already show per-block intro counts and Q status. Drop the now-unused `BulkActionsBar` import and the derived `qPercent` / `trueIntros` / `vipGroupCount` values.

## Coherence check
Pure presentation changes in the MyDay Intros tab. No tables, queries, canon fields, attribution, or React Query keys are touched. Q status is still surfaced per-time-block inside each collapsible header, so no information is lost — just the redundant rollups above it.
