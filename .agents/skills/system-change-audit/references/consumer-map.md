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

## Archived surfaces (Phase Zero + Phase Three + Phase Four funerals)
Do not resurrect these paths. Legacy links auto-redirect. Underlying tables still support live features.
- `/recaps` and `src/pages/Recaps.tsx` — folded into WIG + My Day. Route now redirects to `/my-day`.
- `src/pages/ShiftRecap.tsx` + `src/components/dashboard/ShiftRecapAutoBuild.tsx` — legacy shift-recap editor.
- `src/components/admin/ShiftRecapsEditor.tsx` + `ShiftRecapDetails.tsx` — admin recap editor/details panels.
- `src/features/myDay/WinTheDay.tsx` + `useWinTheDayItems.ts` — Win-the-Day checklist widget.
- `nav.studio` permission key retired; Studio bottom-nav tile removed.
- **Phase Three (one-time backfills, verified 0 pending, DB triggers now enforce)**: `FixVipBookingTypesCard`, `QuestionnaireReconcileCard`, `QuestionnaireSlugBackfillCard` (inline components in `src/pages/Admin.tsx`); `src/components/admin/FixBookingAttribution.tsx` (already unmounted, contradictory query). Do not re-add — the invariants they backfilled are now maintained by triggers `validate_booking_type_canon`, `sync_booking_on_questionnaire_submit`, `auto_create_questionnaire`.
- **Phase Four — Close-out ritual + GroupMe recap pipeline retired**:
  - Deleted: `CloseOutShift.tsx`, `MyDayShiftSummary.tsx`, `ShiftHandoffSummary.tsx`, `ShiftScanOverlay.tsx`, `ActivityTrackerSheet.tsx`, `GroupMeSettings.tsx`, `src/lib/groupme.ts`, `WeeklyContactAvgCard` (Admin Reporting), `EndOfShiftSubmission.tsx`, `ShiftViewPage.tsx`, `ShiftTaskList.tsx`, `ShiftIntroCards.tsx`, `useShiftSubmission.ts`, `src/features/shiftView/index.ts`. AdminOverviewHealth's GroupMe Posts row removed.
  - `shift_recaps` writers now = **`InlineIntroLogger` only** (per-intro attribution anchor for `intros_run.shift_recap_id` / `intros_booked.shift_recap_id`). Contact-count fields (`calls_made`, `texts_sent`, `dms_sent`) have no live writer; historical rows preserved for reporting.
  - `useLeadMeasures` no longer reads `shift_recaps.dms_sent`; the DMs Sent column is gone from the Studio Outreach table.
  - `post-groupme` edge function **kept alive** — still called by `VipAvailability.tsx` for VIP claim announcements (`action: 'custom'`). The function's internal `post` / `resend` branches are dead code but left in place this pass (no client caller).
  - `daily_recaps` table + rows preserved as history; nothing writes new rows.
- **Kept alive**: `shift_recaps` table + FKs (`intros_run.shift_recap_id`, `intros_booked.shift_recap_id`, `outcome_events.shift_recap_id`, `daily_recaps.shift_recap_id`), `InlineIntroLogger`, `ShiftScoreboard` + `src/lib/metrics/constraint.ts`, `useDashboardMetrics`, `useMeetingAgenda`, `useLeadMeasures` (minus DMs), StaffManagement last-active. `sheets_sync_log` retained on a rolling 30-day retention (pruned inline by `import-sheet-leads`).
- **Surviving `src/features/shiftView/` files** (referenced from live surfaces outside the folder — do not delete): `ShiftSelector.tsx` (used by `src/features/myDay/ShiftChecklist.tsx`), `ReferralAskRow.tsx` + `ReferralAskHistorySheet.tsx` + `useReferralAsks.ts` (used by `ShiftChecklist`), `standards.ts` (used by `ShiftChecklist` and `src/components/admin/ShiftTasksAdmin.tsx`).


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

## RingCentral integration (webhook — read-only)
- **Tables:** `rc_message_log` (dedup + unmatched reporting), `rc_subscription` (singleton subscription health)
- **`lead_activities` gets a second writer:** the `ringcentral-webhook` edge function.
  - Outbound RC text → `activity_type='text'`, `performed_by='RingCentral'`. **Counts as contact** for speed-to-lead (in `CONTACT_ACTIVITY_TYPES` set in `src/lib/metrics/constraint.ts`).
  - Inbound RC text → `activity_type='note'`, `performed_by='RingCentral'`. **Does NOT count as contact** — a lead texting us is not us contacting them.
  - Matching order: `leads.phone` last-10-digit match → `intros_booked` fallback (`phone_e164` or last-10) → hop to newest linked lead via `leads.booked_intro_id`. Soft-deleted rows excluded.
- **Dedup:** every RC `message_id` is written to `rc_message_log` first; already-processed ids are skipped. Redelivered webhook events produce zero duplicate activities.
- **Unmatched:** number matches nothing, or matches a booking with no linked lead → `rc_message_log` row with `matched=false` (booking_id stored if any), **no `lead_activities` row written**.
- **Subscription health:** daily pg_cron `rc-renew-subscription-daily` (06:00 UTC) calls `ringcentral-renew-subscription`. Self-healing: missing or expired subscription is recreated and `last_recreated_at` stamped. Surfaced in Admin → Data via `RingCentralHealthCard`.
- **Never touched by this integration:** `CONTACT_ACTIVITY_TYPES`, `script_send_log`, manual contact logging paths (`Leads.tsx`, `NewLeadsModal.tsx`, `ContactLogger.tsx`, `LogActionDialog.tsx`).
- **Secrets (function only):** `RC_CLIENT_ID`, `RC_CLIENT_SECRET`, `RC_JWT`, `RC_STUDIO_NUMBER`.
