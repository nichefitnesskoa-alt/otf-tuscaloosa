## Root cause

`NOT_INTERESTED` is currently in `NON_RAN_RESULT_CANONS` inside `src/lib/canon/introRules.ts`.

That means the canonical helper `didIntroActuallyRun()` returns `false` for Lia and Christian even though they physically attended. Any surface using that helper then drops them from showed/ran counts and close-rate denominators.

Current DB truth for Turbo Coffee:

| Person | booking_status_canon | result_canon | physical attendance |
|---|---|---|---|
| Lia Jacques | NOT_INTERESTED | NOT_INTERESTED | yes |
| Christian Kazoleas | NOT_INTERESTED | NOT_INTERESTED | yes |
| Anna Pauley | SECOND_INTRO_SCHEDULED | SECOND_INTRO_SCHEDULED | yes |
| Emma Hensley | ACTIVE | NO_SHOW | no |

## REACH MAP for system-wide ran/showed change

- Tables touched: none directly. Data read from `intros_booked`, `intros_run`.
- Hooks/queries that read these tables:
  - `src/hooks/useDashboardMetrics.ts` — Studio lead source, Per-SA, studio run totals, close-rate inputs.
  - `src/hooks/useLeadMeasures.ts` — coach lead measure/run counts.
  - `src/hooks/useMeetingAgenda.ts` — meeting recap/run summaries.
  - `src/hooks/useFvTrendData.ts` — FV trend run exclusions.
  - `src/features/myDay/useUpcomingIntrosData.ts` — upcoming/ran classification and SQL exclusion list derived from canon set.
  - `src/features/myDay/useWinTheDayItems.ts` — parent ran detection.
  - `src/pages/Wig.tsx` — WIG funnel and run counts, some inline no-show checks.
  - `src/components/dashboard/ConversionFunnel.tsx` — conversion funnel showed lists, currently partially inline.
  - `src/features/pipeline/selectors.ts` and `PipelineSpreadsheet.tsx` — completed/showed journey states.
  - `src/components/admin/EventCohortPanel.tsx`, `EventsIndexPanel.tsx` — event cohort/showed totals.
- Components that display derived data:
  - WIG tab funnel/drilldowns.
  - Studio Lead Source Analytics.
  - Studio Conversion Funnel.
  - Studio Per-SA / Per-Coach close-rate surfaces.
  - Admin Events index and Event Cohort panel.
  - Pipeline status/table totals.
  - My Day completed/ran counts.
  - Coach/meeting lead-measure summaries.
- Metrics/helpers that derive from these tables:
  - `didIntroActuallyRun` / `NON_RAN_RESULT_CANONS` in `src/lib/canon/introRules.ts`.
  - `isSecondIntroBooking` relies on whether a parent intro actually ran.
  - `resolvePromotedOrphanBookingIds` / journey logic depends on ran detection.
  - `isCloseRun`, `isSaleInRange`, `getRunSaleDate` remain unchanged.
- React Query/cache keys likely holding affected data:
  - DataContext intros cache where used.
  - `['dashboard-metrics', ...]` style hooks if present.
  - `['event-cohort', eventId]`, `['event-cohort', 'all-tagged']`.
  - My Day/upcoming intros query keys.
  - Pipeline query keys.
- Cross-page surfaces affected:
  - WIG, Studio, Admin Events, Pipeline, My Day, Coach lead measures, Meeting agenda, close-rate denominators.
- DB triggers that fire: none, because this is a read/classification logic fix only.

## Plan

1. **Fix the canonical rule at the root**
   - Remove `NOT_INTERESTED` from `NON_RAN_RESULT_CANONS`.
   - Remove `not interested` / `showed up - not interested` from `NON_RAN_RESULT_DISPLAY`.
   - Update the JSDoc so only these are non-ran: `NO_SHOW`, `PLANNING_RESCHEDULE`, `UNRESOLVED`, `VIP_CLASS_INTRO`.
   - This makes `didIntroActuallyRun()` match the studio rule: physical show-up counts, even if they did not buy.

2. **Remove duplicate event-specific attendance logic**
   - Replace inline `didAttendEvent()` logic in `EventCohortPanel.tsx` and `EventsIndexPanel.tsx` with the canonical `didIntroActuallyRun()`.
   - Event showed totals will then agree with Studio/WIG by construction.

3. **Normalize inline funnel checks that bypass canon**
   - In `ConversionFunnel.tsx`, replace `r.result !== 'No-show'` showed checks with `didIntroActuallyRun(r)` plus existing date-range checks.
   - Audit `Wig.tsx` and `PipelineSpreadsheet.tsx` inline `result !== 'No-show'` cases. Update only the places that are computing showed/ran/completed metrics, not label rendering.

4. **Keep true non-attendance excluded**
   - No-shows remain excluded.
   - Planning/reschedule remains excluded.
   - Unresolved remains excluded.
   - VIP class intro remains excluded from standard intro metrics.

5. **Update project memory for future agents**
   - Update `mem://logic/intro-ran-detection` so it explicitly says: `NOT_INTERESTED` means physically attended and counts as ran/showed and coach close-rate denominator.

6. **Verify with real DB rows and cross-page numbers**
   - Re-query the exact Turbo Coffee rows for Lia, Christian, Anna, Emma.
   - Confirm canonical helper behavior on those result canons.
   - Confirm Studio Lead Source Event shows 4 booked / 3 showed / 0 sold.
   - Confirm Studio Conversion Funnel showed drilldowns include Lia and Christian where date range includes June 20, 2026.
   - Confirm Admin Events Turbo Coffee row and Event Cohort panel show 4 booked / 3 showed / 1 no-show / 0 bought.
   - Confirm coach close-rate denominator for James includes Lia and Christian as ran/showed intros.

## Files expected to change

- `src/lib/canon/introRules.ts`
- `src/components/admin/EventCohortPanel.tsx`
- `src/components/admin/EventsIndexPanel.tsx`
- `src/components/dashboard/ConversionFunnel.tsx`
- likely `src/pages/Wig.tsx` and/or `src/features/pipeline/components/PipelineSpreadsheet.tsx` if their showed metrics bypass canon
- `mem://logic/intro-ran-detection`

## Done condition

I will not report this done until the final response includes a COHERENCE PROOF block with the specific Turbo Coffee DB rows and the matching cross-page numbers.