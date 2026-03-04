*Bug fix —* `useLeadMeasures.ts` *missing* `result` *field causing no-shows to be counted as ran.*

*Single change in* `src/hooks/useLeadMeasures.ts` *line 49:*

```
// Before:
.select('id, sa_name, intro_owner, run_date')

// After:
.select('id, sa_name, intro_owner, run_date, result, result_canon')
```

*This allows the existing no-show filter on lines 95–96 to actually fire. No other files need changes.*

*Verify after fix:*

- *Katie's ran count in Lead Measures by SA drops from 9 to 8*
- *All other SA ran counts in Lead Measures table reflect showed = true only*
- *Studio Scoreboard, Conversion Funnel, Lead Source Analytics unchanged — they use a different code path that was already correct*
- *No regression to any other metric*

&nbsp;

&nbsp;

## Bug: `useLeadMeasures` missing `result` field in query

### Root Cause

In `src/hooks/useLeadMeasures.ts` line 48-50, the `intros_run` query selects only `id, sa_name, intro_owner, run_date` — it does **not** include `result` or `result_canon`. The no-show filter on lines 95-96 checks `r.result`, which is always `undefined`, so the filter never fires and no-shows are counted as ran.

This is why Katie shows 9 ran instead of 8 — her 1 no-show is never excluded.

### Audit Results


| Location                                                 | Status     | Issue                                                                                         |
| -------------------------------------------------------- | ---------- | --------------------------------------------------------------------------------------------- |
| `src/hooks/useLeadMeasures.ts`                           | **BROKEN** | Query missing `result` field; no-shows never excluded                                         |
| `src/hooks/useDashboardMetrics.ts`                       | OK         | Uses `run.result !== 'No-show'` correctly; data comes from DataContext which fetches `result` |
| `src/hooks/useMeetingAgenda.ts`                          | OK         | Fetches `result` in query; uses `isNoShow()` filter correctly                                 |
| `src/components/admin/CoachingView.tsx`                  | OK         | Uses DataContext `introsRun` which includes `result`; filters `No-show` on line 75            |
| `supabase/functions/post-groupme/index.ts`               | OK         | Fetches `result, result_canon`; filters correctly on line 114-115                             |
| `src/features/myDay/MyDayPage.tsx`                       | OK         | Already filters no-shows from completed count                                                 |
| `src/components/admin/ShiftRecapDetails.tsx`             | OK         | Already filters no-shows                                                                      |
| `src/components/dashboard/CloseOutShift.tsx`             | OK         | Uses `intros_run` with result field via direct query                                          |
| Lead Source Analytics / Conversion Funnel / Per-SA Table | OK         | All use `useDashboardMetrics` which correctly excludes no-shows                               |


### Fix

**Single change** in `src/hooks/useLeadMeasures.ts` line 49: add `result, result_canon` to the select statement.

```
// Before:
.select('id, sa_name, intro_owner, run_date')

// After:
.select('id, sa_name, intro_owner, run_date, result, result_canon')
```

This ensures the existing no-show filter on lines 95-96 actually works. No other files need changes.

### Verification After Fix

- Katie's ran count drops from 9 to 8 (her 1 no-show excluded)
- All other SA ran counts in Lead Measures table reflect `showed = true` only
- Studio Scoreboard, Conversion Funnel, Lead Source Analytics already correct (different code path)
- No regression to any other metric since this only adds fields to the query