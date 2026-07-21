# Cross-page consumer map

Shared data concepts in this codebase and every surface that reads them. When changing any concept on the left, audit every surface on the right.

## `intros_booked` (canon: `booking_status_canon`)
- MyDay (today's intros, follow-up queue)
- Coach View (`src/pages/CoachView.tsx`, `CoachIntroCard.tsx`)
- WIG (`src/pages/Wig.tsx`, `WigSection.tsx`, `WigFirstVisitSection.tsx`)
- Studio / Dashboard tabs
- Pipeline (`src/features/pipeline/`)
- Follow-Up (`src/features/followUp/`)
- Reports
- DB triggers: `auto_create_questionnaire`, `auto_create_vip_registration`, `auto_set_booked_by_self_booked`, `enforce_intro_time_canon`

## `intros_run` (canon: `result_canon`)
- Same surfaces as `intros_booked`
- Commission feeds (`src/lib/outcomes/commissionRules.ts`)
- Close rate / Total Journey logic (`src/lib/intros/journey.ts`, `close-detection.ts`)
- DB trigger: `sync_booking_coach_from_run`

## `fv_scorecards` (First Visit scorecards)
- Coach View inline scorecard (`ScorecardForm.tsx`)
- WIG First Visit section (`WigFirstVisitSection.tsx`, `CoachScorecardGrid.tsx`)
- Scorecard hooks (`useScorecards`, `useScorecard`, `useFvTrendData`)
- React Query keys: `fv_scorecards`, `fv_scorecard`, `fv_trend_scorecards`, `fv_trend_ran_first_intros`
- DB triggers: `fv_scorecard_log_edits`, `fv_scorecard_notify`, `fv_comment_notify`, `enforce_scorecard_evaluator_role`
- Delete must hit `fv_scorecard_bullets` → `fv_scorecard_comments` → `fv_scorecards` AND invalidate all 4 query keys above.

## Staff / coaches / SAs
- Canonical source (active-only, for pickers/dropdowns/assignments): `useActiveStaff` (`src/hooks/useActiveStaff.ts`)
- Canonical source (all staff incl. inactive, historical stats): `useAllStaff` (`src/hooks/useAllStaff.ts`) + `useRosterWithDataInRange` (`src/lib/staff/rosterInRange.ts`)
- Canon list memory: `mem://logic/canon-lists/coaches`
- **Display-vs-pickers rule**: Any leaderboard/table showing historical numbers uses `useRosterWithDataInRange` so a staff member deactivated mid-quarter keeps their stats. Every assignment surface (booking form, coach picker, evaluator dropdown, `@mention` autocomplete) MUST stay on `useActiveStaff` so inactive staff disappear from future assignments. Getting these mixed up is what caused Ellie/Grace F to reappear as ghosts.
- Consumers: WIG leaderboards, Per-Coach / Per-SA tables, Coach View dropdowns, assignment dropdowns, scorecard evaluator dropdown, dashboard tiles, `@mention` parser (DB trigger `process_own_it_mentions`)
- Inactive staff must vanish from every picker/assignment surface, AND must keep their numbers on every historical display.

## Archived surfaces (Phase Zero funeral)
Do not resurrect these paths. Legacy links auto-redirect. Underlying tables still support live features.
- `/recaps` and `src/pages/Recaps.tsx` — folded into WIG + My Day. Route now redirects to `/my-day`.
- `src/pages/ShiftRecap.tsx` + `src/components/dashboard/ShiftRecapAutoBuild.tsx` — legacy shift-recap editor.
- `src/components/admin/ShiftRecapsEditor.tsx` + `ShiftRecapDetails.tsx` — admin recap editor/details panels.
- `src/features/myDay/WinTheDay.tsx` + `useWinTheDayItems.ts` — Win-the-Day checklist widget.
- `nav.studio` permission key retired; Studio bottom-nav tile removed.
- **Kept alive**: `shift_recaps` writes from `CloseOutShift` and `InlineIntroLogger` (attribution anchor for `intros_run.shift_recap_id` / `intros_booked.shift_recap_id`). GroupMe posting (`post-groupme` edge function) still reads `shift_recaps` for contact counts and still writes `daily_recaps` as its send-log. `GroupMeSettings` and `AdminOverviewHealth` are kept because they read the live send-log.

## Dates / weeks / today
- Canonical helpers: `src/lib/dateUtils.ts`, `src/lib/pay-period.ts`, `src/lib/time/timeUtils.ts`
- All anchored to America/Chicago
- Week labels: "Week of M/D" (no leading zeros, no "wk" prefix)
- Local parsing for `YYYY-MM-DD`: never `new Date(string)`

## Sales / commission / close
- Canonical helpers: `isSaleCanon`, `isCloseRun`, `getRunSaleDate`, `isSaleInRange`, `isEffectiveSale`, `isPostDatedSale` (`src/lib/sales-detection.ts`, `src/lib/intros/close-detection.ts`)
- Consumers: WIG, Studio close rate, Per-Coach / Per-SA tables, Pipeline sold tab, commission feeds, GroupMe recaps, Activity Log
- Post-dated sales (buy_date > today CST) excluded everywhere until buy_date arrives.

## Follow-up ownership
- `follow_up_queue.owner_role`: 'SA' or 'Coach'
- `result_canon = 'FOLLOW_UP'` → Coach for 21 days, then auto-transfer to SA
- Consumers: MyDay follow-up, Coach Follow-Up page, Pipeline, GroupMe nudges
- Never-archive list: `NEVER_ARCHIVE_PERSON_TYPES` in `useFollowUpData.ts` (includes `planning_to_buy`)

## Cache invalidation matrix
After mutating a record, invalidate every key in its row.

| Mutation | Cache keys to invalidate |
|---|---|
| `fv_scorecards` write/delete | `fv_scorecards`, `fv_scorecard`, `fv_trend_scorecards`, `fv_trend_ran_first_intros` |
| `intros_booked` write | bookings query, MyDay query, Coach View query, WIG queries, Pipeline query |
| `intros_run` write | run queries, commission queries, WIG queries, Studio close rate queries |
| `follow_up_queue` write | follow-up queue, MyDay follow-up, Coach Follow-Up |
| `staff` write (is_active flip) | `useActiveStaff`, plus every leaderboard / dropdown that hydrated from it |
