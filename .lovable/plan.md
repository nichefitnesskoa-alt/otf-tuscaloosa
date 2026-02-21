

# Pipeline Default Sort by Created Date

## Summary
Two changes requested:
1. Confirm the shift recap `created_at` fix applies to **all SAs** (not just Sophie) -- already done, no further changes needed
2. Change Pipeline default sort from `class_date` to `created_at` so the most recently **created** booking appears at top

## Changes

### 1. Add `created_at` to Pipeline booking data
- **File: `src/features/pipeline/pipelineTypes.ts`** -- Add `created_at: string;` to `PipelineBooking` interface
- **File: `src/features/pipeline/usePipelineData.ts`** -- Add `created_at` to `BOOKING_SELECT` string; change `.order('class_date', ...)` to `.order('created_at', { ascending: false })`

### 2. Update default sort in selectors
- **File: `src/features/pipeline/selectors.ts`** -- In `buildJourneys`, change the fallback sort from `class_date` to `created_at` so journeys are ordered by most recently created booking first

### 3. Update spreadsheet default sort
- **File: `src/features/pipeline/components/PipelineSpreadsheet.tsx`**:
  - Add `created_at` column to the "all" tab columns (label: "Created")
  - Change `getDefaultSort` for `default` case from `class_date desc` to `created_at desc`
  - Add `created_at` sort value extraction in `getSortValue`
  - Render the created_at cell with a human-readable relative time (e.g., "2h ago")

### 4. SA attribution -- already universal
The shift recap fix from the previous edit uses `user.name` generically -- it already works for all SAs, not just Sophie. No additional changes needed.

## Technical Details

Key code changes:

- `BOOKING_SELECT` gains `created_at` field
- `buildJourneys` sort: `a.bookings[0]?.created_at` replaces `a.bookings[0]?.class_date`
- `getDefaultSort('all')` returns `{ key: 'created_at', dir: 'desc' }`
- New column in "all" tab: `{ key: 'created_at', label: 'Created', sortable: true }`
- `getSortValue` case `'created_at'` returns `b?.created_at || ''`

## What stays the same
- Upcoming tab still sorts by class_date ascending (soonest first)
- Today tab still sorts by class_time ascending
- Completed, No-show, Missed, Not Interested tabs still sort by class_date descending (but users can click "Created" column header to re-sort)
- VIP tab is unchanged
- All existing functionality preserved
