## Goal

Run a one-time, read-only audit across the entire app to confirm that every shared concept (tables, hooks, metrics, staff lists, dates, deletes, attribution) is wired through canonical helpers and produces the same numbers on every surface that reads it. Catch drift that accumulated before the new always-on Core rule existed.

## Why now

The audit-on-every-change rule prevents future drift, but it doesn't retroactively scan what's already in the codebase. A single sweep now establishes a clean baseline so the rule has something coherent to defend going forward.

## Scope — the 7 reach areas from the consumer map

1. **intros_booked** → MyDay, Coach View, WIG, Studio, Pipeline, Follow-Up
2. **intros_run / close rate** → Commission, Per-Coach, Per-SA, WIG
3. **fv_scorecards** → Coach View, WIG FV section, all 4 React Query keys
4. **Active staff** → every leaderboard, every dropdown, WIG tiles, assignment selects
5. **Follow-up ownership** → Follow-Up page, MyDay queue, Coach View
6. **Sales / commission** → Commission, WIG, Per-SA, Activity Log, GroupMe
7. **Week grouping** → WIG weekly, GroupMe recap, pay-period boundaries

## Method

For each area, two passes:

**Pass A — code reach map (static).** Grep every reader/writer/derived metric. Flag any place that:
- Reimplements a canonical helper inline (`didIntroActuallyRun`, `isCloseRun`, `getRunSaleDate`, `isSaleInRange`, `useActiveStaff`, date helpers, role helpers)
- Uses `new Date('YYYY-MM-DD')` instead of local parse
- Builds a staff list from `[...new Set(rows.map(...))]` instead of `useActiveStaff`
- Filters on legacy strings instead of `*_canon` fields
- Invalidates an incomplete set of React Query keys on a delete/clear path

**Pass B — DB coherence proof (live data).** For each area, run `read_query` and verify the same number appears on every surface listed. Example: pick one coach, confirm their close rate matches across Commission, Per-Coach table, and WIG.

## Deliverable

A single audit report with three sections:

- **Clean** — areas where code + data agree everywhere. No action.
- **Drift found** — specific file:line locations where a helper was reimplemented, a query key was missed, or numbers disagree across pages. Each entry gets a one-line fix proposal.
- **Canonical helpers to extract** — concepts that now appear in 2+ files and should be hoisted into `src/lib/`.

No code changes in this pass. The report becomes the input to a follow-up build (or builds) that you approve item-by-item.

## What this is NOT

- Not a refactor. No files edited in this pass.
- Not a UI change. Pure read-only investigation.
- Not a security audit (separate tool exists for that).
- Not a performance audit.

## Estimated effort

~15–25 `read_query` calls, ~30–50 grep/file reads, mostly parallelizable via spawn_agent. One consolidated report at the end.

## Decision points before I start

1. **Scope** — all 7 areas, or a subset? (Default: all 7.)
2. **Output format** — markdown report in chat, or written to `/mnt/documents/audit-YYYY-MM-DD.md` for later reference? (Default: both.)
3. **Auto-fix threshold** — should I auto-queue trivial drift (e.g. one inline reimplementation) as a follow-up build, or list everything and let you triage? (Default: list everything, you triage.)
