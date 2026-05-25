## Goal
Two fixes:
1. **Display** — show the first-timer's name and class date on the "Recent scorecards" row, the drawer title, and the eval header.
2. **Access control** — make it structurally impossible for SA-only staff to evaluate a coach. Fix at UI, server, and field-population layers (Koa's instruction).

---

## Part 1 — Display: member name + class date

**Data source:** `fv_scorecards.first_timer_id → intros_booked.member_name`. Falls back to `practice_name` for practice scorecards, then `'First-Timer'`.

**Files:**
- `src/hooks/useScorecards.ts` — extend the list query to join `intros_booked!fv_scorecards_first_timer_id_fkey(member_name)` and surface as `first_timer_name`. Add same to `useScorecard` (single). If the FK isn't named in PostgREST, use a manual fetch + map.
- `src/components/scorecard/CoachDashboard.tsx` (line 171–173) — main label: `{s.first_timer_name || s.practice_name || 'First-Timer'} · {format(class_date, 'MMM d')}`. Move "by {evaluator_name} · Self/Formal" to the subtitle.
- `src/components/scorecard/ComparisonView.tsx` (line 40, 51) — drawer title: `Scorecard — {first_timer_name || practice_name || 'First-Timer'}`. Keep evaluatee/evaluator/date in the body card.
- `src/components/scorecard/WigFirstVisitSection.tsx` (line 314) — same label treatment.
- `src/components/scorecard/BookingScorecards.tsx` — already booking-scoped, no name change needed.

---

## Part 2 — Lock scoring to Coach/Both/Admin (three layers, per your instruction)

### Root cause
`UnscoredDrillDown.tsx:22-23` auto-selects `eval_type='formal_eval'` whenever `user.name !== coach`. `CoachIntroCard.tsx:300` passes `showEvalToggle` unconditionally. The form's own gate uses `user?.role === 'Admin'`, which violates the canon (`isAdmin = isKoa`). And nothing in the UI or DB stops an SA from opening a scoring sheet. That's exactly how Kaiya (SA) submitted formal evals on Koa on May 20.

### Layer 1 — UI gates (hide all entry points from SA-only)
Use the canonical helpers from `src/lib/auth/roles.ts`:
- `canScore(u) = isCoachLike(u) || isAdmin(u)` — new helper, exported from `roles.ts`.
- `canFormalEval(u) = isAdmin(u)` — replaces every `user?.role === 'Admin'` check in scoring code.

Files:
- `src/components/scorecard/UnscoredDrillDown.tsx` — wrap the entire surface in `if (!canScore(user)) return null`. Default `evalType` becomes `'self_eval'` when `isAdmin(user)` viewing their own, else only renders for `isCoachLike`. SAs no longer see the drill-down at all.
- `src/components/coach/CoachIntroCard.tsx` — the "Score" button and `<ScorecardFormBody>` block render only when `canScore(user)`. `showEvalToggle={canFormalEval(user)}`. Default `scorecardEvalType` stays `'self_eval'`.
- `src/components/scorecard/ScorecardForm.tsx` line 237 — swap `user?.role === 'Admin'` for `canFormalEval(user)`. The whole `<ScorecardFormBody>` returns `null` early when `!canScore(user)` as a belt-and-suspenders guard.
- `src/components/scorecard/WigFirstVisitSection.tsx` — any "score now" CTA inside hidden behind `canScore`.

### Layer 2 — Server enforcement (RPC + trigger)
A new migration adds a Postgres function `public.create_scorecard(...)` (security definer) that:
1. Looks up `staff.role` by the incoming `evaluator_name`.
2. Rejects with `RAISE EXCEPTION 'evaluator_role_not_permitted'` if the role isn't `Coach`, `Both`, or evaluator name isn't `Koa`.
3. Inserts into `fv_scorecards` and returns the new row.

Also a `BEFORE INSERT OR UPDATE` trigger on `fv_scorecards` that runs the same role check on `NEW.evaluator_name` — so direct-table writes (or future code paths) can't bypass it. Role is read from `staff` at write time, never stored on the scorecard, so it can't drift (matches your "derive at query time" rule).

`useScorecards.ts` insert mutation switches from `.from('fv_scorecards').insert(...)` to `supabase.rpc('create_scorecard', ...)`.

### Layer 3 — Evaluator dropdown (where one exists)
`ScorecardForm.tsx` line 278 — wherever evaluator is selectable, the option list is filtered to staff with `role IN ('Coach','Both')` or `name='Koa'`. Computed from `useStaff()` at render time, no separate flag. SAs never appear as a choice.

### Layer 4 — Audit surface (do not auto-correct)
New admin page `src/pages/admin/ScorecardAuditPage.tsx` linked from Admin tab:
- Queries every `fv_scorecards` row, joins `staff` by `evaluator_name`, and lists any record whose evaluator's current role is `SA`-only (excludes Koa identity).
- Columns: evaluator_name, evaluator_role, scorecard_date, evaluatee_name, eval_type, member_name (via `first_timer_id`), `created_at`. Sort newest first.
- Read-only. You decide what to do with each row.
- Add a count badge to the Admin nav when rows exist.

---

## Part 3 — One-time data correction (your call: convert)
A `supabase--insert` migration updates the two known bad rows by id:
- `a5274c81-b8cb-4614-868c-9955c0083d0b` (Jasmine Walker, May 20)
- `2238f3de-ace7-4ae5-b93c-a5a5ffe94f5c` (Lexi Tsounis, May 20)

Set `evaluator_name='Koa'`, `eval_type='self_eval'`, append an `fv_scorecard_edit_log` row for each documenting the correction (editor `'System'`, field `evaluator_name` and `eval_type`, old → new). No bullet scores touched.

---

## Verification before reporting done
- **Display:** open WIG → Scorecards drawer for an existing real record; confirm "Jasmine Walker · May 20" shows in row title and "Scorecard — Jasmine Walker" in drawer header. Practice scorecards still show their custom name.
- **UI lockout:** sign in as Kaiya (SA). Confirm no Score button on CoachIntroCard, UnscoredDrillDown returns null, WIG scoring CTA hidden.
- **Server lockout:** attempt a raw insert with `evaluator_name='Kaiya'` via `supabase--insert`; expect the trigger to raise `evaluator_role_not_permitted`.
- **Dropdown:** open the evaluator picker as Koa; confirm Kaiya/Jayna/Madison/Zoe are not in the list, Jackson/James/Natalya/Nathan are.
- **Audit page:** after migration runs, list should show 0 rows. Re-insert a test bad row directly with the trigger temporarily off → list shows it. (Trigger then re-enabled.)
- **Data fix:** the two May 20 rows now show `evaluator_name=Koa`, `eval_type=self_eval`; edit log has two new entries.
- **Counts:** Self this month for Koa goes up by 2; Formal this month goes down by 2; total unchanged.

## Files touched (summary)
- `src/lib/auth/roles.ts` (add `canScore`, `canFormalEval`)
- `src/hooks/useScorecards.ts` (join member_name; switch insert to RPC)
- `src/components/scorecard/CoachDashboard.tsx`
- `src/components/scorecard/ComparisonView.tsx`
- `src/components/scorecard/WigFirstVisitSection.tsx`
- `src/components/scorecard/UnscoredDrillDown.tsx`
- `src/components/scorecard/ScorecardForm.tsx`
- `src/components/coach/CoachIntroCard.tsx`
- `src/pages/admin/ScorecardAuditPage.tsx` (new)
- Admin route registration in router
- Migration: `create_scorecard` RPC + role-check trigger on `fv_scorecards`
- Data migration: update two May 20 rows + edit-log entries
