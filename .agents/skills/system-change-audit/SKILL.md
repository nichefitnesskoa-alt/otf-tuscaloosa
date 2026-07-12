---
name: system-change-audit
description: Use on ANY change, fix, update, refactor, delete, clear, archive, or rename that touches Postgres tables (intros_booked, intros_run, fv_scorecards, follow_up_queue, leads, staff, milestones, vip_sessions, monthly_lead_totals, shift_task_completions), hooks/queries, React Query cache keys, dates/weeks/pay-periods, staff/coach/SA lists, or any metric/concept (close rate, commission, attribution, WIG, intros run/booked, follow-up ownership, week grouping, active staff, sales, lead source). Also use when the user reports bugs with phrasing like "still showing", "doesn't match", "you didn't catch", "everywhere", "across all tabs", "audit", "system fix", "off by", "ghost", "missing", or names any cross-page surface (WIG, Studio, Coach View, MyDay, Pipeline, Follow-Up, Commission, Leaderboard). Forces a reach-map before code and a COHERENCE PROOF before done so fixes don't land on one page while other consumers keep the old behavior.
---

# System Change Audit

This project (OTF Tuscaloosa studio app) has one dominant failure mode: a fix lands on the surface the user pointed at, and every other page that reads the same data keeps the old behavior. Examples: WIG vs Studio vs Coach View showing different numbers for the same person; deleted records still appearing somewhere; week grouping off by one column; inactive staff still in leaderboards.

This skill enforces the workspace rule already in project knowledge ("map the reach, prove coherence") with a hard checklist. Do not skip steps.

## When to run this skill

Run it before writing code if ANY of the following are true:
- The change touches a table, hook, helper, or metric that more than one page reads.
- The change is a delete, clear, archive, or reset path.
- The change involves dates, week grouping, "today", or pay periods.
- The change filters or iterates over staff, coaches, or SAs.
- The user used the phrase "still showing", "didn't fix it everywhere", "across all tabs", "doesn't match", "you didn't catch", "audit", or "system fix".
- The change touches close rate, ran intros, sales, commission, attribution, or follow-up ownership.

If unsure, run it. The cost of running it is one extra paragraph; the cost of skipping it is another regression.

## Step 1 — Reach map (BEFORE writing code)

Produce this list in chat. Do not start editing until it exists.

```
REACH MAP for <change>
- Tables touched: <list>
- Hooks/queries that READ these tables: <list, with file:line>
- Components that DISPLAY data derived from these tables: <list>
- Metrics/helpers that DERIVE from these tables: <list of files in src/lib/>
- React Query cache keys that hold this data: <list>
- Cross-page surfaces affected: <WIG / Studio / MyDay / Coach View / Pipeline / Follow-Up / commission / leaderboards>
- DB triggers that fire on writes/deletes: <list>
- Alternate storage locations — before treating one table/setting as the source of truth, search for a second place the same concept could be computed or stored, especially in a feature built in a different session. List any found.
```

If a concept appears in 2+ places in this list, extract it to a canonical helper as part of THIS change. See `references/consumer-map.md` for the known cross-page dependencies in this codebase.

## Step 2 — Branch-specific checks

Run only the branches that apply.

**Delete / clear / archive branch.** A delete is not done until:
1. The DB row is actually gone (or soft-deleted with `deleted_at` + `booking_status_canon = 'DELETED_SOFT'` per project rules).
2. RLS allows the delete (check policies — silent failures are common).
3. EVERY React Query cache key that held the deleted row is invalidated. Not just the most obvious one.
4. Parent components are notified of a DELETE event, never as a synthetic submitted/zero value.
5. Verify with `read_query` that the row is gone AND that every dependent metric (WIG totals, drilldowns, unscored counts, etc.) recomputed.

**Date / timezone branch.**
- Never `new Date(dateString)` for a `YYYY-MM-DD` value — it shifts by timezone. Use local parsing: `const [y,m,d] = s.split('-').map(Number); new Date(y, m-1, d);`
- All "today", week start, pay period math anchors to America/Chicago. Use existing helpers in `src/lib/dateUtils.ts` and `src/lib/pay-period.ts`. Do not reimplement.
- Week labels: explicit format like "Week of 5/11", never bare "5/11" or "wk 5/11".

**Staff list branch.**
- Any list of staff/coaches/SAs comes from `useActiveStaff` (or the canonical coaches list in `mem://logic/canon-lists/coaches`). Never iterate a derived array, hardcoded list, or `Set` of names collected from data rows.
- Inactive staff (`is_active = false`) must disappear from leaderboards, WIG tiles, drilldowns, AND assignment dropdowns — verify all four.

**Metric / canon branch.**
- Use canon fields (`booking_status_canon`, `result_canon`, `booking_type_canon`) for all filters and counts. Never legacy string matching when a canon exists.
- Use the canonical helpers: `didIntroActuallyRun`, `isCloseRun`, `getRunSaleDate`, `isSaleInRange`. Do not reimplement these inline.

## Step 3 — Coherence proof (BEFORE saying done)

End the response with a block in this exact shape:

```
COHERENCE PROOF
- DB verification:
  - <SELECT ...> → <result>
- Cross-page check:
  - WIG: <number / state>
  - Studio: <number / state>
  - Coach View: <number / state>
  - <any other affected surface>: <number / state>
- All agree: yes / no
- Files touched: <list>
- Canonical helpers extracted: <list, or "none needed">
- Anything surfaced during audit not in original prompt: <list, or "none">
```

If "All agree" is "no", the build is not done. Continue.

## Anti-patterns (do not do these)

- Editing one component without running the reach map.
- Invalidating only the most obvious query key after a delete.
- Using `new Date(string)` on a `YYYY-MM-DD` value.
- Building a staff list from `[...new Set(rows.map(r => r.coach_name))]`.
- Saying "this should work" or "the build succeeded" as the closing line.
- Treating a user's "still showing" report as a UI bug — it is always a system-coherence bug until proven otherwise.

## Bundled references

- `references/consumer-map.md` — known cross-page dependencies in this codebase.
