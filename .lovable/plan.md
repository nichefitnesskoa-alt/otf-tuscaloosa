## SYSTEM-WIDE COHERENCE AUDIT — READ-ONLY REPORT

This is a findings report. No code was modified. Triage and fixes are out of scope for this prompt.

---

## HIGH SEVERITY — produces wrong numbers in user-facing surfaces

### H1. Two competing `isVipBooking` implementations that DISAGREE on COMP

**Concept:** "Is this booking a VIP/COMP event?"

**Locations (drift confirmed):**
- `src/lib/canon/introRules.ts:11-19` — does NOT include `booking_type_canon === 'COMP'`
- `src/lib/vip/vipRules.ts:25-32` — DOES include `booking_type_canon === 'COMP'`

**Drift impact:** A COMP booking is treated as VIP by callers using `vipRules.ts` (PipelineRowCard, PipelineSpreadsheet, useUpcomingIntrosData, QuestionnaireHub, IntegrityDashboard) but as a normal intro by callers using `introRules.ts` (`isUnresolvedPastIntro` chain). Same booking renders differently on different surfaces.

**Recommended:** Delete the duplicate in `introRules.ts`, re-export `isVipBooking` from `vipRules.ts`. Add a regression test for COMP coverage.

**Effort:** small.

---

### H2. No-show detection scattered across 8+ files with three different spellings

**Concept:** "Was this run a no-show?"

**Inline implementations:**
- `src/hooks/useDashboardMetrics.ts:264, 490, 508` — `res === 'no-show' || res === 'no show'` (legacy display strings)
- `src/hooks/useLeadMeasures.ts:83, 127` — same pattern
- `src/hooks/useMeetingAgenda.ts:411, 420, 487` — same pattern
- `src/components/dashboard/PerSATable.tsx:86` — same pattern
- `src/components/dashboard/CloseOutShift.tsx:123` — `result_canon === 'NO_SHOW' || result === 'No-show'`
- `src/components/dashboard/ReferralLeaderboard.tsx:99` — `lower === 'no-show' || lower === 'no show'`
- `src/components/admin/ClientJourneyPanel.tsx:418` — canon + display mix
- `src/features/pipeline/selectors.ts:149` — canon + display mix
- `src/features/myDay/MyDayPage.tsx:159` — `result_canon === 'NO_SHOW'` only (misses legacy)
- `src/features/myDay/useUpcomingIntrosData.ts:293, 334` — server-side `not in (NO_SHOW,...)` filter

**Canonical helper that already exists:** `didIntroActuallyRun()` in `src/lib/canon/introRules.ts:82`. It correctly handles both canon AND legacy display strings AND PLANNING_RESCHEDULE, UNRESOLVED, VIP_CLASS_INTRO. Nine of the inline checks above only test for "no-show" and miss those other non-ran states — meaning they OVER-count "ran" intros vs the canonical helper. This is the same class of bug as the Alexa funnel issue.

**Drift impact:** Per-SA, dashboard metrics, meeting agenda, and lead measures may all report different "ran" denominators than Pipeline / Coach view (which use the canon helper).

**Recommended:** Replace every inline check with `didIntroActuallyRun(r)`.

**Effort:** medium (mechanical, ~15 sites, must verify each callsite's negation polarity).

---

### H3. Membership sale detection — duplicated outside the helper in 4 surfaces

**Concept:** "Is this run/result a membership sale?"

**Canonical helper:** `isMembershipSale()` in `src/lib/sales-detection.ts:18` (used correctly in ~15 files).

**Inline duplicates / leaks:**
- `src/pages/ShiftRecap.tsx:730-731` — `outcomeLower.includes('premier')` etc. for commission calculation. Drifted: this branch determines `commissionAmount`, but lives outside `commissionRules.ts`.
- `src/pages/Recaps.tsx:140` — `MEMBERSHIP_RESULTS = ['premier','elite','basic']` array, then `.some(includes(r))`.
- `src/features/vips/VipPerformanceDashboard.tsx:92` — `['premier','elite','basic'].some(m => r.result.toLowerCase().includes(m))`.
- `src/components/admin/DataHealthPanel.tsx:259` — inline `.includes('premier') || ...`.
- `src/components/admin/ShiftRecapDetails.tsx:245` — same inline tri-string includes for badge color.
- `src/components/admin/ObjectionReport.tsx:54` — same inline includes (inverted for non-sales).
- `src/pages/Leads.tsx:104` — `.or('result.ilike.%premier%,...')` Postgres-side, inline.
- `src/lib/canon/canonFallback.ts:41-49` — separate canonicalization map. Acceptable as canon-side, but no test ensures it stays in sync with `isMembershipSale`.

**Drift impact:** If a new tier is added (e.g. "Founder"), 7 inline lists must be edited. Risk of silent miscount on Recaps, VIP dashboard, Data Health, Objection Report.

**Recommended:** Replace each inline list with `isMembershipSale()` import. Migrate ShiftRecap commission branch to `commissionRules.ts`. Add a test that asserts `canonFallback` and `isMembershipSale` agree.

**Effort:** small–medium.

---

### H4. Total Journey chain traversal duplicated and inconsistent

**Concept:** "Walk from a 1st-intro booking through `originating_booking_id` children to detect a downstream sale."

**Implementations found:**
- `src/lib/intros/close-detection.ts:resolveClosedFirstIntroIds` — canonical, async DB query, batched.
- `src/pages/Wig.tsx:361, 511-518` — own chain assembly via `secondIntroBookingMap`.
- `src/components/admin/ClientJourneyPanel.tsx:407, 517` — `data.runs.some(isMembershipSale)` after own join.
- `src/features/pipeline/selectors.ts:82, 138` — `journey.runs.some(isMembershipSale)`.
- `src/components/dashboard/ConversionFunnel.tsx` — `personHasPassedSecond` set built locally (recent fix, not extracted).
- `src/pages/CoachMyIntros.tsx:330-411` — its own chain walk.
- `src/features/myDay/useUpcomingIntrosData.ts:172, 260-357` — its own walk including out-of-batch fetch.
- `src/components/dashboard/CoachPerformance.tsx`, `PerCoachTable.tsx`, `PerSATable.tsx` — local chain logic.

**Drift impact:** The "is this 1st-intro closed?" question can return different answers on Wig vs ConversionFunnel vs Pipeline vs CoachDashboard if any one of them forgets a soft-delete filter, a VIP filter, or a `referred_by_member_name` exclusion. This is the exact pattern that produced the "10 ran / 7 closed vs 9 ran / 7 closed" discrepancy.

**Recommended:** Extract a sync `walkJourneyChain(rootBookingId, allBookings, allRuns) → { ranBookings, soldBookings, secondIntros }` into `src/lib/intros/journey.ts`. Refactor every consumer to use it. Add a test fixture covering Alexa's shape + the May 1/May 5 case + a deleted-orig case.

**Effort:** large (touches many files but each call is small; the real cost is the regression test matrix).

---

### H5. Coach attribution fallback ("run vs booking, TBD override") inlined in Wig only

**Concept:** "When booking.coach_name is blank/TBD, fall back to run.coach_name."

**Inline:**
- `src/hooks/useFvTrendData.ts:126-130` — fallback logic inline
- `src/pages/Wig.tsx:472-474, 555-556` — `isMissingCoach(b.coach_name) ? linkedRunForCoach?.coach_name ...`, `resolveCloseCoach(...)` — but `isMissingCoach` and `resolveCloseCoach` are local to Wig.tsx, not exported.
- `src/components/dashboard/PerCoachTable.tsx` — does its own coach resolution.
- DB trigger `sync_booking_coach_from_run` ALSO fills `coach_name` when blank.

**Drift impact:** A booking with `coach_name = 'TBD'` may be attributed differently on Wig (uses run override) vs Per-Coach table (may use booking field directly) vs Coach Dashboard. Affects close-rate leaderboards and commission attribution.

**Recommended:** Extract `resolveCoachForBooking(booking, runs)` to `src/lib/intros/coachAttribution.ts`. Use everywhere a coach name is shown for a metric.

**Effort:** small–medium.

---

## MEDIUM SEVERITY — wrong numbers in admin/report views, or coverage gaps

### M1. `RAN_EXCLUDED` set duplicated separately from `NON_RAN_RESULT_CANONS`

- `src/hooks/useFvTrendData.ts:25` — `const RAN_EXCLUDED = new Set(['NO_SHOW', 'UNRESOLVED', 'VIP_CLASS_INTRO'])`
- `src/lib/canon/introRules.ts:59` — `NON_RAN_RESULT_CANONS = new Set(['NO_SHOW','PLANNING_RESCHEDULE','UNRESOLVED','VIP_CLASS_INTRO'])`

**Drift:** `useFvTrendData` is missing `PLANNING_RESCHEDULE`. FV trend numerators will count cancelled bookings as ran.

**Recommended:** Import and use `NON_RAN_RESULT_CANONS` from `introRules.ts`.

**Effort:** trivial.

---

### M2. `isUnresolvedPastIntro` chain (in introRules) hard-codes booking-status excludes that overlap with `isBookingExcludedFromMetrics`

- `src/lib/canon/introRules.ts:99-128` — `isResolvedOutcome` / `isUnresolvedPastIntro` use their own sets of `bCanon` and `bLegacy` strings.
- `src/lib/intros/excludedBookings.ts` — separate exclusion logic (covers VIP + DELETED_SOFT + DUPLICATE + DEAD).
- `src/features/followUp/useFollowUpData.ts:190, 272-317` — yet another inline canon comparison set for the same buckets.

**Drift:** The "needs follow-up" and "intro showed up" decisions can diverge from "is this booking counted in metrics."

**Recommended:** Audit these three modules together; consolidate booking-state predicates into one file with explicit names (`isResolvedOutcome`, `isExcludedFromMetrics`, `isUnresolvedPastIntro`) that compose, not duplicate.

**Effort:** medium.

---

### M3. Cross-page close count surfaces — verify all use `isCloseRun`

`isCloseRun` / `isCloseResult` is used in: `Wig.tsx`, `CoachMyIntros.tsx`, `VipClassPerformanceTable`, `VipSchedulerTab`, `orphanedFirstIntros`. NOT used in (still inline `isMembershipSale` chains): `ConversionFunnel.tsx`, `PerCoachTable.tsx`, `PerSATable.tsx`, `CoachPerformance.tsx`, `BookerStatsTable.tsx`, `ClientJourneyPanel.tsx`, `pipeline/selectors.ts`. These are functionally equivalent today (since `isCloseResult = isSaleCanon || isMembershipSale`) but the duplication means future canon changes (e.g. a new tier value) only flow through one path automatically.

**Recommended:** Migrate every "did this run close" check to `isCloseRun`/`isCloseResult`. Forbid `isMembershipSale(r.result)` in close-detection contexts via a lint rule or comment header.

**Effort:** small.

---

### M4. Date range filtering — `isDateInRange` has TWO signatures with the same name

- `src/lib/sales-detection.ts:92` — `isDateInRange(dateStr, startDate, endDate)` (string-based)
- `src/hooks/useDashboardMetrics.ts:105` — local `function isDateInRange(dateStr, range: DateRange | null)` (object-based)

**Drift:** Two functions with the same name doing different things. PayPeriodCommission imports the string one; useDashboardMetrics shadows it locally. Confusing for future reads; risk of accidentally importing the wrong one.

**Recommended:** Rename the local one to `isDateInDateRange` or move both to a single helper module.

**Effort:** trivial.

---

### M5. Soft-delete filter coverage — at least one consumer missing it

The audit grep shows `.is('deleted_at', null)` in ~30 query sites — good. But:
- `src/components/admin/FixBookingAttribution.tsx:56-57` — explicitly queries deleted records, that's intentional.
- `src/features/myDay/useUpcomingIntrosData.ts:357` — fetches an `originating_booking_id` row by ID without `.is('deleted_at', null)`. Then line 363 checks `!(origBooking as any).deleted_at` post-hoc. Works, but inconsistent.
- `src/components/dashboard/ConversionFunnel.tsx` — uses local `excludedBookingIds` set instead of pre-filtering at query time. Works but adds drift risk.

**Recommended:** Standardize: filter at query time with `.is('deleted_at', null)` whenever you don't need deleted rows. Use `isBookingExcludedFromMetrics` only as a defense-in-depth check.

**Effort:** small.

---

### M6. Eval type detection mostly clean — one inline ratio risk

`eval_type === 'self_eval' / 'formal_eval'` is compared inline in ~10 files. There's no helper, but the values come straight from the DB enum and are stable. The risk is **coverage rows must sum to 100%** (workspace rule cites this explicitly). Today:
- `CoachDashboard.tsx:40-41` — `selfCount` and `formalCount` from `submitted` array. No "unscored" denominator computed here.
- `useFvTrendData.ts:213-254` — computes self/formal/closed/notClosed but not an explicit unscored coverage check.

**Recommended:** Add a coverage calculator in `trends.ts` that returns `{ selfPct, formalPct, unscoredPct }` summing to 100, used everywhere coverage is shown.

**Effort:** small.

---

## LOW SEVERITY — code duplication, no observed user-facing impact

### L1. `intros_run` "was this a sale?" by canon vs legacy
`src/components/dashboard/FABFollowUpPurchaseSheet.tsx:85` filters `result_canon === 'SOLD'`. No 'SOLD' value exists in the canonical canon list (`SALE`, `PREMIER`, `PREMIER_OTBEAT`, `ELITE`, `BASIC`). **This filter likely matches zero rows.** Confirm by querying production.

### L2. `is_vip` filter inlined as `b.is_vip` boolean check vs `isVipBooking()` helper
Found in: `useDashboardMetrics.ts:150`, `useIntroTypeDetection.ts:27`, `useLeadMeasures.ts:77`, `lib/introHelpers.ts:60`, `features/shiftView/ShiftIntroCards.tsx:17`, `useMeetingAgenda.ts:298`. These miss the `vip_session_id`-only and `lead_source.includes('vip')` and `booking_type_canon === 'VIP'/'COMP'` cases.

### L3. `cadenceStreakWeeks` only consumed in two places
`CoachStreakBadges` (CoachDetail) and `CoachDashboard`. WIG leaderboard does not display it — minor surface inconsistency, possibly intentional.

### L4. Pipeline `'no_show'` lowercase string status appears in ~15 places
A union type — fine — but the mapping from `result_canon NO_SHOW` → pipeline status `'no_show'` happens inline in `selectors.ts`. Consider extracting `bookingStatusToPipelineStatus()`.

### L5. `isMembershipSale` is re-exported from `studio-metrics.ts` AND directly importable from `sales-detection.ts`
Two import paths for the same function. Pick one and remove the other to avoid future drift if either signature changes.

---

## ROLE PERMISSION DRIFT

Audit of `useAuth().user.role` checks shows enforcement happens at three layers: route guards (`src/App.tsx`), component-level checks (`isAdmin = user?.role === 'Admin'` repeated in 10+ files), and server-side via Supabase RLS.

### R1. `isAdmin` recomputed in every file instead of from AuthContext
`AuthContext` exposes `canAccessAdmin` and `canAccessDataTools`, but most components inline `user?.role === 'Admin'` instead. New roles (e.g., `'Both'` from staff table) are mapped to `'Admin'` in `getRoleForName` — but if any future role is added, every inline check must be updated. **No drift today**, but high risk.

**Recommended:** Use `canAccessAdmin` from AuthContext consistently. Add `canAccessCoaching`, `canAccessSA` getters.

### R2. Coach VIP read-only enforcement — verify
Workspace knowledge says coach VIP access is read-only. Component-level checks were not exhaustively verified in this audit. Recommend a follow-up audit grepping all `vip_*` mutations for a role guard.

### R3. Pipeline tab hidden from SA — confirmed in App.tsx route guard, but no component-level fallback if route is reached directly.

---

## DATABASE STATE CHAINS

### D1. Total Journey chain — see H4. Multiple traversals, inconsistent filters.

### D2. Scorecard → first_timer_id → intros_booked — consistent
`useScorecards`, `useFvTrendData` both join correctly. `intros_booked.deleted_at` is filtered in `useFvTrendData` but a scorecard for a soft-deleted booking would still display in `BookingScorecards.tsx`. Low risk.

### D3. VIP touchpoint → vip_member → vip_registrations — DB trigger `bump_vip_last_interaction` handles this. Application code does not duplicate.

### D4. Follow-up assignment chain — `useFollowUpData.ts` builds it inline (~500 lines). Not extracted. High coupling but no observed bugs.

---

## DISCOVERED PATTERNS (not in original prompt)

### P1. Three competing "what is the result of this run" canon maps
- `src/lib/canon/canonFallback.ts:RESULT_CANON_MAP` — maps `'premier' → 'PURCHASED'`
- `src/lib/intros/resultLabels.ts:SALE_CANONS` — set of `['SALE','PREMIER','PREMIER_OTBEAT','ELITE','BASIC']`
- `src/lib/sales-detection.ts:isMembershipSale` — string `.includes()` check

These three operate on different canon values (`PURCHASED` vs `SALE`/`PREMIER` vs raw display strings). A run with `result_canon = 'PURCHASED'` is treated as sale by `canonFallback` but NOT by `isSaleCanon` (which doesn't include 'PURCHASED'). Could produce silent miscount if the DB ever writes `'PURCHASED'` as a canon value (current canon docs in `resultLabels.ts` say it shouldn't, but `canonFallback.ts` and `dataAuditEngine.ts:764` both reference `'PURCHASED'`). **Confirm one canonical name and delete the other.**

### P2. `commissionRules.ts:29` — `tier.includes('premier') return 7.50` overlaps with `ShiftRecap.tsx:730` doing its own `commissionAmount = 7.5`. These could drift independently. ShiftRecap should call `commissionForTier(tier)` from commissionRules.

### P3. `MyDayPage.tsx:159-163` — counts `result_canon === 'NO_SHOW'` and `'DIDNT_BUY'` only via canon, ignoring legacy display strings. Inconsistent with the rest of the no-show handling.

### P4. `intros/duplicateRuns.ts` already exists as an audit tool, but only one consumer (`DuplicateRunsAlert.tsx` on Recaps page). Useful pattern; consider expanding the alert to ConversionFunnel/Wig where the same duplication produced the Alexa bug.

---

## SUMMARY COUNTS

- High-severity findings: 5
- Medium-severity findings: 6
- Low-severity findings: 5
- Role/permission concerns: 3
- DB chain concerns: 4 (1 critical, see H4)
- Discovered patterns: 4

## RECOMMENDED FIX ORDER (when ready to build)

1. H1 — merge `isVipBooking` (small, removes COMP drift today).
2. P1 — collapse three canon maps to one (prevents silent regressions in upcoming changes).
3. H2 — replace inline no-show checks with `didIntroActuallyRun` (prevents the Alexa-class bug from reappearing in 9 more places).
4. H4 — extract `walkJourneyChain` helper. Backed by a regression fixture covering the Alexa shape + May-1/May-5.
5. H5, H3, M1–M3 — clean up coach attribution + sale-detection inlining.
6. R1, M4–M6, L1–L5, P2–P4 — hygiene pass.

No code changes were made in this audit.