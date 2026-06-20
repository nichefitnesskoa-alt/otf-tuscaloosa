# Auto-replicate FV Scorecards across same-class intros

## What this changes for the coach

When a coach submits a First Visit scorecard for one intro, the app finds the **other intros in the exact same class** (same coach, same class_date, same class_time, not excluded, not yet scored) and **auto-creates a submitted scorecard for each of them** using the same bullets, notes, class type, and member count. Coach can still tap any one of them and adjust if the experience differed.

If one of those intros later resolves as a **no-show, cancellation, planning_reschedule, or soft-delete** (or the intro_run result is logged NO_SHOW), the **auto-created replica for that intro is removed**, so the coach isn't credited / debited for an intro that didn't actually happen. Replicas the coach manually edited after creation are preserved — only untouched replicas get cleaned up.

## Scope rules

- "Same class" = same `coach_name` + `class_date` + `class_time` on `intros_booked`, excluding the source booking, excluding bookings already excluded from metrics (`isBookingExcludedFromMetrics`), excluding bookings whose `booking_status_canon` is `NO_SHOW`, `CANCELLED`, `PLANNING_RESCHEDULE`, or `DELETED_SOFT` at submit time, and excluding bookings that already have a scorecard for that class_date + evaluator.
- Replicas copy: all 15 bullets, all 5 column scores, total, level, class_type, member_count, interactions/otbeat/handback notes, evaluator, evaluatee, eval_type. `is_practice=false`. `submitted_at = now()`.
- Replicas are flagged with a new column `replicated_from_scorecard_id` pointing at the source scorecard.
- "Untouched replica" = `replicated_from_scorecard_id IS NOT NULL` AND no edits since creation (we compare `updated_at` and bullet rows). Touched replicas stay; coach intent wins.

## Reach map (verified before coding)

- Tables touched: `fv_scorecards` (new column), `fv_scorecard_bullets`, `intros_booked` (read only), `intros_run` (read only).
- Readers/displayers: `useScorecards` / `useScorecard` hooks → `BookingScorecards`, `ComparisonView`, `CoachScorecardGrid`, `CoachDashboard`, `CoachScorecards` page, `UnscoredDrillDown`, `WigFirstVisitSection`, `ClientJourneyPanel`, `CoachIntroCard`.
- Writers we hook into: `ScorecardFormBody.finalizeSubmission` (replicate on submit), `applyIntroOutcomeUpdate` (cleanup on NO_SHOW / CANCELLED / PLANNING_RESCHEDULE / DELETED_SOFT and on `intros_run.result_canon = NO_SHOW`).
- React Query keys to invalidate after replicate or cleanup: `['fv_scorecards']`, `['fv_scorecard', id]`, plus any WIG/coach view invalidation already used by the form (`fv_*` keys).

## Implementation

1. **Migration**
   - `ALTER TABLE public.fv_scorecards ADD COLUMN replicated_from_scorecard_id uuid NULL REFERENCES public.fv_scorecards(id) ON DELETE SET NULL;`
   - Index on `(coach_name_unused?)` — not needed; queries hit `evaluatee_name + class_date + class_time` which is small.

2. **New helper `src/lib/scorecard/replicate.ts`**
   - `replicateScorecardToSiblings(sourceScorecardId): Promise<{created: string[]}>`
     - Loads source card + bullets.
     - Resolves the source booking's `coach_name`, `class_date`, `class_time`.
     - Queries `intros_booked` for siblings (same coach + date + time, not the source, valid canon statuses, not excluded).
     - For each sibling: skip if `fv_scorecards` already has a row with `first_timer_id = sibling.id` AND `evaluator_name = source.evaluator_name` AND `class_date = source.class_date`. Otherwise insert a new scorecard row (mirroring all fields, `submitted_at = now()`, `replicated_from_scorecard_id = source.id`) and bulk-insert the bullet rows.
   - `cleanupReplicasForBooking(bookingId): Promise<{deleted: string[]}>`
     - Finds `fv_scorecards` where `first_timer_id = bookingId` AND `replicated_from_scorecard_id IS NOT NULL`.
     - For each, verifies it's still "untouched": `updated_at <= created_at + 5s` AND no bullet rows updated after creation. (We use `created_at`/`updated_at` already on the table.)
     - Deletes the bullets then the scorecard.

3. **Hook into submit** (`src/components/scorecard/ScorecardForm.tsx`)
   - In `finalizeSubmission`, after the existing `submitted_at` update, call `replicateScorecardToSiblings(id)`. Show a toast: `Replicated to N other intros in this class`. Invalidate the same React Query keys the rest of the form already invalidates.

4. **Hook into outcome cleanup** (`src/lib/outcome-update.ts` → `applyIntroOutcomeUpdate`)
   - After the booking status is finalized, if the resulting canon is `NO_SHOW`, `CANCELLED`, `PLANNING_RESCHEDULE`, `DELETED_SOFT`, OR the new `intros_run.result_canon` is `NO_SHOW`, call `cleanupReplicasForBooking(bookingId)`. Invalidate `['fv_scorecards']`.

5. **Verification (DB)**
   - Pick a recent class with multiple intros from `intros_booked`, simulate the helper, confirm rows created and bullets mirrored.
   - Pick a booking, mark NO_SHOW, confirm only the untouched replica is removed; a manually-edited replica stays.

## Out of scope

- No change to score math, level thresholds, or WIG/coach metrics logic — they keep reading `fv_scorecards` as-is.
- No data-model collapse (we are NOT switching to one-scorecard-per-class).
- No change to practice scorecards (`is_practice=true` never replicates).
- No change to commission, attribution, or follow-up logic.

## Files

- `supabase/migrations/<ts>_fv_scorecards_replicated_from.sql` (new)
- `src/lib/scorecard/replicate.ts` (new)
- `src/components/scorecard/ScorecardForm.tsx` (hook submit)
- `src/lib/outcome-update.ts` (hook cleanup)
- `src/lib/scorecard/__tests__/replicate.test.ts` (new — covers sibling matching, skip-if-already-scored, untouched-only cleanup)

## Coherence proof I'll produce before reporting done

```
COHERENCE PROOF
- DB verification:
  - SELECT id, first_timer_id, replicated_from_scorecard_id FROM fv_scorecards WHERE replicated_from_scorecard_id = '<source>'
  - SELECT booking_status_canon FROM intros_booked WHERE id IN (...siblings)
- Cross-page check:
  - Coach View "FV Scorecards" on each sibling intro: shows L<n> · <score>/30
  - WigFirstVisitSection unscored count: drops by N
  - CoachScorecards page: N new rows for evaluator on class_date
- All agree: yes
- Files touched: <list>
- Canonical helpers extracted: replicateScorecardToSiblings, cleanupReplicasForBooking
```
