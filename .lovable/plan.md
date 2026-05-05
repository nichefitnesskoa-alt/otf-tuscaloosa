
# First Visit Experience Scorecard — Investigation + Build Plan

## PART 1 — INVESTIGATION REPORT

### Old lead measure fields in the database

On `intros_booked`:
- `shoutout_consent` — pre-class shoutout permission
- `coach_shoutout_start` — pre-class shoutout done
- `coach_shoutout_end` — post-class shoutout done
- `coach_referral_asked` — POS referral ask
- `coach_referral_names` — names captured
- `coach_brief_why_moment` — coach's pre-class WHY plan
- `coach_member_pair_plan` — member-pair plan
- `coach_debrief_submitted` / `..._by` / `..._at` — debrief flag

On `intros_run`:
- `goal_why_captured` — used WHY in class
- `made_a_friend` — introduced to a member
- `relationship_experience` — which member

Per your answer, ALL of the above (except the debrief flag triple) are in scope to archive and remove. Debrief flag stays as the marker that a scorecard equivalent was completed.

### Code references to those fields (every file)

WIG / dashboard:
- `src/pages/Wig.tsx` (lines 265–767) — pulls `coach_shoutout_start/end`, `shoutout_consent`, `coach_member_pair_plan`, `coach_debrief_submitted`, `referred_by_member_name`, plus `intros_run.goal_why_captured/made_a_friend`. Renders the entire "Coach Lead Measures" table (Pre %, Post %, Got Curious %, Pairing %, Overall WIG %).
- `src/components/dashboard/ReferralAskTracker.tsx` — POS Referral Ask tile reads/writes `coach_referral_asked` + `referral_ask_followup_pending`.

Coach View / debrief UI:
- `src/components/coach/CoachIntroCard.tsx` — full POST-CLASS toggle block (shoutout consent, start, end, used WHY, introduced member + member name, referral ask + names). Validation, save handlers, debrief submit.
- `src/components/coach/CoachPrePostClass.tsx` — pre/post-class consent + 5 toggles + referral.
- `src/pages/CoachView.tsx` — selects shoutout/pair fields; passes into card.

My Day / pipeline:
- `src/features/myDay/IntroRowCard.tsx`, `IntroDayGroup.tsx`, `UpcomingIntrosCard.tsx`, `useUpcomingIntrosData.ts`, `myDayTypes.ts`, `__tests__/myDay-selectors.test.ts` — propagate `shoutoutConsent` for Their Story display.
- `src/features/pipeline/components/PipelineDialogs.tsx`, `pipelineTypes.ts`, `usePipelineData.ts`, `__tests__/pipeline-corruption-guards.test.ts` — same.

SA brief / story:
- `src/components/shared/SABriefFields.tsx`, `src/components/shared/TheirStory.tsx` — read `shoutout_consent`.
- `src/components/dashboard/PrepDrawer.tsx` — print/PDF prep sheet shows shoutout + pair plan + why moment.

Meeting / agenda:
- `src/pages/Meeting.tsx`, `src/components/meeting/ShoutoutsSection.tsx`, `src/hooks/useMeetingAgenda.ts` — "Shoutouts" here is the member-shoutouts list (people to recognize), NOT the coach lead-measure shoutout. Different concept, leave untouched.

Admin / ops:
- `src/components/admin/ClientJourneyPanel.tsx`, `src/components/admin/ShiftRecapDetails.tsx` — display old fields in journey/recap views.
- `src/pages/ShiftRecap.tsx` — touches the same fields.

Types: `src/integrations/supabase/types.ts` (auto-regenerated).

### WIG page query/render surface

Single page, `src/pages/Wig.tsx`, sections:
1. Scoreboard (Leads + Close Rate cards) — keep
2. **Coach Lead Measures table** (Pre/Post/Curious/Pairing/Overall) — REMOVE
3. SA Lead Measures table (POS Referral Ask, Packs Gifted) — keep
4. `<ReferralAskTracker>` — keep
5. `<MilestonesDeploySection>` — keep

The "Coached / Closes / Close %" columns of the coach table use `intros_run.result` via `isMembershipSale` — that becomes the basis for the new closing % calc.

### First-timer / intro schema (current)

Source-of-truth chain for a first visit:
- `intros_booked` (id uuid, member_name, class_date, intro_time, coach_name, lead_source, originating_booking_id, booking_status_canon, booking_type_canon, is_vip, vip_session_id, deleted_at, …)
- `intros_run` (linked_intro_booked_id → intros_booked.id, coach_name, result, result_canon, buy_date, run_date, …)
- `intro_questionnaires` (booking_id → intros_booked.id)

There is no `leads.joined` or `intros_booked.joined` column. Per your answer, "joined" = `EXISTS (intros_run WHERE linked_intro_booked_id = booking.id AND isMembershipSale(result))` using existing `isMembershipSale` in `src/lib/sales-detection.ts`. This matches Total Journey logic already used everywhere.

### Foreign key path: scorecard → coach

`fv_scorecards.evaluatee_id uuid → staff.id` (and `evaluator_id → staff.id`). `staff.name` is the display label everywhere else in the app, so the scorecard form will pick coaches from `staff WHERE 'Coach' = ANY(role) AND is_active`. Scorecards stay forever even if `is_active` flips false (departed coach requirement).

### Notification system

Minimal `notifications` table already exists (target_user, notification_type, title, body, read_at, meta jsonb). `LeadAlertBell.tsx` exists but only reads new-lead alerts — we'll extend it to render scorecard-related notifications.

---

## PART 2 — CONFIRMED VALUES

- Monthly Level 3 target per coach: **6**
- "Joined" signal: `EXISTS intros_run with isMembershipSale(result)` for the booking
- Archive scope: ALL coach lead-measure fields listed above (everything except the `coach_debrief_submitted*` triple, which becomes the scorecard-submitted flag)

---

## PART 3 — BUILD ORDER

### A. Database migration

1. **Archive table** `archived_first_timer_lead_measures_legacy`:
   - `id uuid pk`, `booking_id uuid`, `run_id uuid nullable`, `coach_name text`, `class_date date`, `member_name text`
   - All legacy columns: `shoutout_consent`, `coach_shoutout_start`, `coach_shoutout_end`, `coach_referral_asked`, `coach_referral_names`, `coach_brief_why_moment`, `coach_member_pair_plan`, `goal_why_captured`, `made_a_friend`, `relationship_experience`
   - `original_created_at timestamptz`, `archived_at timestamptz default now()`
   - INSERT … SELECT from `intros_booked` LEFT JOIN `intros_run` for every row where ANY legacy field is non-null. RLS: admin select only.
2. Verify row count > 0, then `ALTER TABLE intros_booked DROP COLUMN …` and `ALTER TABLE intros_run DROP COLUMN …` for the listed fields.
3. **New tables** (per spec, with required `id/created_by/created_at`, RLS public read+insert+update, no delete; admin-only delete):
   - `fv_scorecards` — full schema from spec. `total_score` = generated column `tread+rower+floor+otbeat+handback`. `level` = generated CASE. CHECK constraint: `(first_timer_id IS NOT NULL) <> is_practice` and `is_practice = false OR practice_name IS NOT NULL`.
   - `fv_scorecard_bullets` — composite unique (scorecard_id, bullet_key).
   - `fv_scorecard_comments`
   - `fv_scorecard_edit_log`
4. Trigger on `fv_scorecards` UPDATE → write `fv_scorecard_edit_log` rows for changed fields.
5. Trigger on INSERT/UPDATE → insert `notifications`:
   - self_eval → target_user = 'Koa' (admin)
   - formal_eval → target_user = evaluatee staff.name
   - level = 3 → second notification, type `level_3_landed`, target Koa, banner-eligible
6. Add `intros_booked` to existing realtime publication (already there); add `fv_scorecards` to realtime for live-feed.
7. `studio_settings` row: `fv_monthly_l3_target = 6`.

### B. Data layer

- `src/lib/scorecard/levels.ts` — pure helpers (`scoreToLevel`, `BULLET_KEYS`, `CLASS_TYPES`, label maps). Locked bullet keys per spec.
- `src/lib/scorecard/closing.ts` — given booking ids, returns `joined: Set<string>` using `isMembershipSale` over linked runs.
- `src/hooks/useScorecards.ts` — React Query: list by date range / coach, single by id, mutations (upsert scorecard, upsert bullet, comment).
- `src/hooks/useScorecardMetrics.ts` — derive WIG tiles + leaderboard rows + trend series.
- Realtime subscription on `fv_scorecards` for live activity feed + L3 banner.

### C. UI components (new)

- `src/components/scorecard/ScorecardForm.tsx` — header card, 5 sections with segmented 0/1/2 controls, sticky total tile, sticky submit. Auto-save on blur; submit triggers reveal.
- `src/components/scorecard/ScorecardSection.tsx` — one section with live subtotal in header.
- `src/components/scorecard/BulletControl.tsx` — segmented 3-button control (gray / amber / green).
- `src/components/scorecard/ScoreReveal.tsx` — animated badge + confetti (canvas-confetti, already a common dep — add if missing) on L3 only. Identity-language copy lines.
- `src/components/scorecard/ComparisonView.tsx` — eval tiles + 15-row bullet table + notes side by side + comments thread.
- `src/components/scorecard/CommentsThread.tsx` — list + composer; posts notification.
- `src/components/scorecard/CoachDashboard.tsx` — empty-state template + tiles + growth-curve chart (recharts, already used) + column bars + recent list.
- `src/components/scorecard/EmptyTemplateScorecard.tsx` — all bullets pre-filled at "2 — Hit Standard" for new-coach onboarding.
- `src/components/scorecard/ScorecardBadgeStack.tsx` — for intro card ("Self-Eval ✓ L3 / Formal Evals: 2").

### D. Coach View intro card integration

In `CoachIntroCard.tsx`:
- DELETE the entire PRE-CLASS / POST-CLASS toggle block and all related state, validation, save handlers, and helpers.
- DELETE `CoachPrePostClass.tsx` (no other consumers).
- ADD action row: `Score This Intro` (orange, primary) + `Evaluate This Coach` (outline) + ScorecardBadgeStack. Buttons open `ScorecardForm` in a sheet. After self-eval exists → button becomes "View My Scorecard". Tap badge stack → ComparisonView in a sheet.
- Mark `coach_debrief_submitted = true` automatically when the coach's self-eval is submitted, so existing "debrief done" indicators keep working downstream.

### E. WIG page redesign

In `src/pages/Wig.tsx`:
- Remove `loadLeadMeasures`, `coachLeadMeasures` state, the entire Coach Lead Measures `<Card>` block, and the `goal_why_captured/made_a_friend` query path. Remove unused imports.
- Add new section "First Visit Experience — Month to Date" between Scoreboard and SA Lead Measures:
  - Studio top tiles (4): Total L3, Closing %, Avg score of closes (toggle self/formal), Avg overall score
  - `<CoachLeaderboardTable>` with 6/2 progress visual, sortable
  - `<TrendLineChart>` (recharts) — last 90d weekly avg, overlay toggle per coach
  - `<LiveActivityFeed>` — realtime, confetti on L3 row, banner toast on L3 to admin
  - `<MonthlyGoalTile>` — per-coach progress vs 6, studio aggregate bar
- Keep SA Lead Measures, ReferralAskTracker, MilestonesDeploySection unchanged.

### F. Reports tab

- New route `/reports`, page `src/pages/Reports.tsx`, role: all.
- Add to `BottomNav` for all roles (replace one less-used slot for SA, append for Coach/Admin).
- Date-range picker (reuse `DateRangeFilter`) + filter chips (multi-coach, class type, eval type, level, practice toggle).
- Tab 1 — Coach Lead Measures: scorecards submitted (self vs formal), level distribution stacked bar, avg score per coach bar, 15×N bullet heatmap (coaches rows × bullets cols), 6/month adherence, self-vs-formal gap chart.
- Tab 2 — WIG Lead Measures: closing % over time, L3 over time, avg close vs non-close, referral asks (existing), milestones (existing).
- Each section has a one-line plain-English caption. CSV export per section using existing pattern (papaparse or hand-roll — check `PayrollExport`).

### G. Navigation

`src/components/BottomNav.tsx`:
- Coach nav adds `My Scorecards` → `/coach-scorecards/me` (CoachDashboard for current user).
- Admin nav adds `Coach Scorecards` → `/coach-scorecards` (CoachDashboard with picker).
- All roles: `Reports` → `/reports`. Mobile real estate: collapse Coach View + My Intros into single dropdown for Admin if needed; for Coach the 3-icon row becomes 5 — switch to a horizontally scrollable nav rather than shrinking labels (keep 44px tap targets).

### H. First-timer detail / scorecards section

In `ClientActionDialog.tsx` / `ClientJourneyPanel.tsx` (and any "intro detail" sheet) add a **Scorecards** section listing every scorecard tied to the booking. Tap → ComparisonView.

### I. Notifications wiring

- `LeadAlertBell` extended (or new `NotificationsBell`) — reads `notifications` for current `target_user`. Bell badge count = unread. Click opens drawer listing items. Click item routes to scorecard/comparison.
- L3 banner — top-of-page banner for admin when unread `level_3_landed` notifications exist.
- Comment / reply notifications — DB triggers on `fv_scorecard_comments` insert.

### J. Cleanup pass (delete old code paths)

- Delete legacy field reads in: `CoachIntroCard.tsx`, `CoachPrePostClass.tsx` (file), `PrepDrawer.tsx` (Shoutout rows in print), `SABriefFields.tsx` (consent select), `TheirStory.tsx` (consent toggle + save), `IntroRowCard.tsx`, `IntroDayGroup.tsx`, `UpcomingIntrosCard.tsx`, `useUpcomingIntrosData.ts`, `myDayTypes.ts`, `myDay-selectors.test.ts`, `PipelineDialogs.tsx`, `pipelineTypes.ts`, `usePipelineData.ts`, `pipeline-corruption-guards.test.ts`, `ClientJourneyPanel.tsx`, `ShiftRecapDetails.tsx`, `ShiftRecap.tsx`, `Wig.tsx`, `ReferralAskTracker.tsx` (only the `coach_referral_asked` writes — the POS-ask UX itself stays; switch tracking to a new `pos_referral_asks` table OR keep the column out of archive — see open question below).

OPEN: `coach_referral_asked` is consumed by the SA "POS Referral Ask" WIG tile, which you said to keep. Archiving the column kills that tile. Plan: keep `coach_referral_asked` + `coach_referral_names` (they power POS Referral Ask, which is an SA measure not a coach lead measure), and archive only the four true coach lead measures: `shoutout_consent`, `coach_shoutout_start`, `coach_shoutout_end`, `coach_brief_why_moment`, `coach_member_pair_plan`, `goal_why_captured`, `made_a_friend`, `relationship_experience`. **CONFIRM this carve-out before I drop columns** — otherwise the POS Referral Ask WIG tile loses its data source in this same build.

### K. Tests & verification checklist

- Migration dry-run: archive count matches non-null source count.
- New tables: insert via app → row appears, RLS allows public select/insert/update, no delete from app.
- Submit self-eval → reveal fires, Koa notification row created.
- Submit formal eval → coach notification row.
- L3 submit → confetti + admin banner.
- WIG page renders with no console errors after old fields dropped.
- All other consumers (PrepDrawer print, TheirStory, MyDay rows) render with no missing-field errors.
- Coach role sees My Scorecards + Reports; SA does not see Pipeline/Studio; Admin sees everything.
- Central Time used for `class_date` filtering and "this month" tiles.

---

## PART 4 — DOWNSTREAM EFFECTS LIST (built in this prompt)

1. Wig.tsx coach lead measures section removed
2. Coach View intro card debrief block replaced with scorecard CTAs
3. CoachPrePostClass.tsx deleted
4. PrepDrawer print sheet — shoutout/why/pair rows removed
5. TheirStory + SABriefFields — shoutout consent UI removed
6. MyDay row card + types + selectors — shoutoutConsent prop removed
7. Pipeline dialogs/types/hooks/tests — same
8. ClientJourneyPanel + ShiftRecap detail — legacy field rows removed
9. BottomNav — new entries for Coach/Admin/All
10. Routes added for `/coach-scorecards`, `/coach-scorecards/me`, `/reports`
11. Notifications bell extended for scorecard events
12. First-timer detail dialog gets Scorecards section
13. Archive table preserves all historical data with attribution and timestamps
14. supabase types regenerated automatically post-migration

---

## CONFIRM BEFORE I BUILD

- Carve-out in section J (keep `coach_referral_asked` + `coach_referral_names` because POS Referral Ask SA tile depends on them) — yes / no?
