## Add "Evaluator" dropdown to scorecard header

Currently the evaluator silently defaults to the logged-in user (`user?.name`). The coach being evaluated has no clear way to see who scored them, and an admin doing a formal eval has no way to attribute it to themselves explicitly.

### Change

In `src/components/scorecard/ScorecardForm.tsx`, update the header grid from a 4-column layout to a **5-column layout** (`md:grid-cols-5`) so it stays inline:

```
DATE | CLASS TYPE | COACH | EVALUATOR | MEMBER COUNT
```

- New **Evaluator** dropdown using the canonical `COACHES` array from `src/types` (same source as the Coach dropdown), since evaluators are also staff/coaches.
- Default value = logged-in `user?.name` (same as today).
- On change, update local `evaluator` state and persist via `ensureScorecard()` on next bullet/note save (already wired — `evaluator_name` is included in the update payload). No extra save logic needed.
- Submit validation: require evaluator to be set (block submit with toast if empty), matching the existing Coach validation pattern.

### Files touched

- `src/components/scorecard/ScorecardForm.tsx` — header grid + new Select, validation line in `handleSubmit`.

### Out of scope (not changed)

- Database schema (`evaluator_name` column already exists on `fv_scorecards`).
- Dashboard / comparison views — already read `evaluator_name`.
- Coach picker logic on `CoachScorecards.tsx`.

### Downstream effects

- `fv_scorecards.evaluator_name` will now reflect the chosen evaluator instead of always the logged-in user — this is the intended behavior and existing read paths already display it.
- No role/permission changes; any logged-in staff can still create scorecards.
