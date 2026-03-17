

## Root Cause: Column Mapping Breaks for Rows Without Dates

The test mode output shows that **rows with a date have 10 values** and **rows without a date have 8 values**:

```text
No-date row (8 elements):
[timestamp, first, last, email, phone, rawSubject, messageId, status]
 index: 0        1      2     3      4        5          6        7

Date row (10 elements):
[timestamp, first, last, email, phone, DATE, TIME, rawSubject, messageId, status]
 index: 0        1      2     3      4     5     6       7          8         9
```

The code has **fixed column indices**: `MESSAGE_ID = 8`, `STATUS = 9`. This works for 10-element date rows, but for 8-element no-date rows, index 9 is out of bounds and returns `''` — causing those rows to be **silently filtered** (`skippedFiltered++`).

Previously this didn't matter because no-date rows were imported by the Apps Script webhook (`import-lead`). Now that the Apps Script is failing (`NON_2XX_404`), the sheet importer is the fallback — but it can't read the status for these rows.

**This explains the 17 skippedFiltered rows — those are your highlighted unprocessed leads.**

## Plan

### Fix `supabase/functions/import-sheet-leads/index.ts`

Replace the fixed `COL.MESSAGE_ID` and `COL.STATUS` lookups with dynamic index detection based on row length:

- If `row.length >= 10` → date row: STATUS at index 9, MESSAGE_ID at index 8 (current behavior)
- If `row.length <= 8` → no-date row: STATUS at index 7, MESSAGE_ID at index 6

This is a single change: create a helper function that returns the correct STATUS and MESSAGE_ID indices based on `row.length`, and use it in the main loop. The rest of the column mappings (FIRST through PHONE at indices 1-4) are unaffected since they're the same in both layouts.

No database changes needed.

