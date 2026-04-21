

## Goal
VIP-class-booked intros count as their own type — no questionnaire required, labeled "VIP Class Intro" (not 1st/2nd), and any sale credits the coach who ran the original VIP class (not the coach who ran the follow-up intro).

## How a "VIP Class intro" is identified
A booking is a **VIP Class Intro** when `lead_source = 'VIP Class'` or `'VIP Class (Friend)'` AND `vip_session_id` is set. (These are real `intros_booked` rows with `booking_type_canon = 'STANDARD'` — VIP isolation rules don't apply, since they're now real intros that converted from the VIP event.)

## Changes

### 1. New column on `vip_sessions`: `coach_name text`
The VIP class coach is currently not tracked anywhere. Per your answer, the SA picks the coach in the My Day VIP Group card. One column on `vip_sessions`, set once and reused for every intro booked off that session.

### 2. My Day VIP Group card — `VipRegistrationsSheet.tsx`
Add a single **"Who coached this VIP class?"** dropdown at the top of the sheet (above the registrant list). Options = `COACHES` array. Auto-saves on change to `vip_sessions.coach_name`. Pre-selected if already set. Required before any "Booked an Intro" outcome can be saved (toast + block submit if missing).

### 3. No questionnaire for VIP Class intros
- **`src/lib/introHelpers.ts` → `autoCreateQuestionnaire`**: skip if booking's `lead_source` starts with `'VIP Class'`. Returns silently. (Defensive — covers all callers.)
- **`VipRegistrationsSheet.tsx` booking insert**: stop calling `autoCreateQuestionnaire` for the primary VIP booking AND the friend booking. Set `questionnaire_status_canon = 'not_required'` on insert (new canonical value, parallel to how 2nd intros are handled).
- **`useUpcomingIntrosData.ts` → status derivation**: when `questionnaire_status_canon === 'not_required'` OR booking is a VIP Class intro, treat as a "no Q needed" item — exclude from `filterNoQ`, exclude from the day's `qSentRatio` denominator (mirror the existing `isSecondIntro` treatment in `myDaySelectors.ts` lines 81, 105).
- **`QuestionnaireHub.tsx` "missing Q" sweep** (line 660): exclude VIP Class lead_source bookings from the missing list.

### 4. New label: "VIP Class Intro" (not 1st / not 2nd)
- **`UpcomingIntroItem`** (`myDayTypes.ts`): add `isVipClassIntro: boolean`.
- **`useUpcomingIntrosData.ts`**: set `isVipClassIntro = true` when `lead_source` starts with `'VIP Class'` AND `vip_session_id` is set. When true, force `isSecondIntro = false` (a VIP intro is neither 1st nor 2nd in this taxonomy).
- **`IntroTypeBadge.tsx`**: accept new optional `isVipClassIntro` prop. When true, render purple badge "VIP Class Intro" (uses existing `bg-purple-500/15 text-purple-700 border-purple-500/30` from the VIP Class lead-source palette). Falls through to existing 1st/2nd logic otherwise.
- **`PrepDrawer.tsx` line 328**: pass `isVipClassIntro` through.
- **`IntroRowCard.tsx`** Q-badge logic (lines 42–44, 57–60): when `isVipClassIntro`, render `"No Q Needed"` static badge (same treatment as 2nd intros).
- **`PrepScoreDot.tsx`**: treat `isVipClassIntro` as Q-ready (same as `isSecondIntro`).
- **`useSmartScriptSelect.ts` / `ScriptPickerSheet.tsx` / `CardGuidance.tsx`**: where `isSecondIntro` controls "skip Q link" or "no questionnaire needed" copy, also branch on `isVipClassIntro` so script flows skip Q-link insertion and show "Ready for VIP intro. No questionnaire needed." copy.

### 5. Sale credit goes to the VIP class coach — not the follow-up coach
This is the core attribution fix. The follow-up intro (booked from the VIP event) still has its own `coach_name` (the coach running that day's class). But for **close-rate reporting**, when the booking is a VIP Class Intro and a sale lands, credit the coach stored on the linked `vip_sessions.coach_name`.

Touched in two places only — both already query `intros_run.coach_name` for closes:

- **`src/pages/Wig.tsx` Per-Coach close map** (lines 408–474): for runs whose linked booking is a VIP Class intro, replace `r.coach_name` with the `vip_sessions.coach_name` of the booking's `vip_session_id` when crediting `coachCloseMap` (both direct sale and Total-Journey 2nd-intro sale paths). Also include those runs in the coach's `coached` denominator (the showed-first-intro aggregate at lines 372–406): the VIP coach gets +1 coached for each VIP Class intro that showed.
- **`src/components/dashboard/PerCoachTable.tsx`** (Studio → Recaps): same swap inside the `filtered.forEach` loop at lines 56–77. When the run's linked booking is VIP Class, credit the VIP-session coach instead of the run's coach. Pre-fetch `vip_sessions.coach_name` keyed by `vip_session_id` once per render via `useData()` (or a dedicated hook).

Lead-measure fields (pre/post shoutout, why-captured, made-a-friend, debrief) stay credited to the actual coach who ran that follow-up class — those measure execution of *that* class, not the VIP class. Only the **close** flips.

### 6. Per-SA / Total Journey funnel — unchanged
SA close rate (`intro_owner` attribution), Total Journey funnel (1st intros booked → any sale), commission (intro_owner), Per-SA Performance: all stay as-is. VIP Class intros remain `STANDARD` bookings with proper `intro_owner`, so SA-side metrics don't shift. Only the per-coach close attribution moves.

## Files changed
1. **DB migration**: `ALTER TABLE vip_sessions ADD COLUMN coach_name text;`
2. **`src/features/myDay/VipRegistrationsSheet.tsx`** — coach picker at top, auto-save, required before booking, stop creating questionnaires, set `questionnaire_status_canon = 'not_required'`
3. **`src/lib/introHelpers.ts`** — skip questionnaire creation for VIP Class lead sources (defensive)
4. **`src/features/myDay/myDayTypes.ts`** — add `isVipClassIntro: boolean`
5. **`src/features/myDay/useUpcomingIntrosData.ts`** — set `isVipClassIntro`; force `isSecondIntro=false` when VIP Class
6. **`src/features/myDay/myDaySelectors.ts`** — exclude VIP Class intros from `filterNoQ` and `qSentRatio` denominator
7. **`src/components/dashboard/IntroTypeBadge.tsx`** — render "VIP Class Intro" purple badge when flagged
8. **`src/components/dashboard/PrepDrawer.tsx`** — pass `isVipClassIntro` to badge
9. **`src/features/myDay/IntroRowCard.tsx`** — "No Q Needed" badge for VIP Class intros
10. **`src/components/dashboard/PrepScoreDot.tsx`** — treat VIP Class as Q-ready
11. **`src/hooks/useSmartScriptSelect.ts`, `src/components/scripts/ScriptPickerSheet.tsx`, `src/components/dashboard/CardGuidance.tsx`** — VIP Class branches alongside `isSecondIntro`
12. **`src/components/dashboard/QuestionnaireHub.tsx`** — exclude VIP Class bookings from "missing Q" sweep
13. **`src/pages/Wig.tsx`** — Per-Coach close attribution: VIP Class intros credit the VIP session coach
14. **`src/components/dashboard/PerCoachTable.tsx`** — same VIP-coach swap on Recaps page

## Files audited, no change needed
- `intros_booked` schema — already has `vip_session_id` and `lead_source = 'VIP Class' / 'VIP Class (Friend)'`
- VIP isolation rules (`vipRules.ts`) — VIP Class intros are real `STANDARD` bookings, not VIP-typed bookings; existing isolation logic continues to exclude only `booking_type_canon IN ('VIP','COMP')`
- Pipeline / WIG / Per-SA close-rate (intro_owner attribution) — unchanged
- Commission (intro_owner) — unchanged
- All other callers of `autoCreateQuestionnaire` (`WalkInIntroSheet`, `BookIntroSheet`, `PipelineDialogs`) — defensive guard inside the helper covers them

## Downstream effects (explicit)
- Booking from VIP Group card now records `coach_name` on `vip_sessions` (or requires it before save)
- New VIP Class intros never get a questionnaire row created → cleaner `intro_questionnaires` table going forward
- VIP Class intros render with purple "VIP Class Intro" badge wherever 1st/2nd badges appear
- VIP Class intros excluded from "Send questionnaires" focus suggestions, NoQ filter, day Q-ratio denominator, and QuestionnaireHub missing-Q sweeps
- Per-Coach close rate (Recaps + WIG): VIP class coach gets credit for VIP-converted sales — even if a different coach ran the intro that closed the sale
- Per-Coach lead-measure rates (pre/post shoutout, why-captured, pairing, debrief) still attribute to the coach who ran that specific intro — not the VIP class coach
- Per-SA close rate, Total Journey funnel, commission, Pipeline tabs, Coach View, Follow-Up queue: unchanged
- No retroactive backfill — `vip_sessions.coach_name` defaults NULL for past sessions; legacy VIP sales without a recorded VIP coach fall back to current behavior (run coach gets credit). Once SAs start picking the coach in My Day, new VIP closes credit correctly.
- No effect on role permissions
- All Central Time conventions preserved
- Realtime subscriptions on `intros_booked` continue to drive UI; `vip_sessions.coach_name` change refetches via existing My Day data hook
