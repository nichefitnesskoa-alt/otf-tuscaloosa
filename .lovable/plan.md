## Goal

Stop relying on trigger words or manual skill invocation. Get the audit behavior to run automatically on essentially every change that could cause a cross-page regression — without depending on the user saying "still showing" or "audit."

## Why this is the right shape

- Core memory rules in `mem://index.md` load on **every** request, no triggers. That's the only true "always on" mechanism available.
- Skills are retrieval-loaded by design — they can't be forced on every turn at the platform level. But their trigger descriptions can be broadened to fire on far more request shapes.
- The combination of (a) always-on condensed checklist in Core + (b) broader skill triggers for the long-form version covers ~95% of real requests automatically.

## Changes

### 1. Add a new always-on Core rule in `mem://index.md`

Insert a single Core bullet titled **"Audit-on-every-change"** containing the one-page condensed checklist:

- BEFORE code: name every table/hook/component that reads or writes the changed data; if a concept appears in 2+ files, extract or route through a canonical helper as part of THIS change.
- DURING code: apply the relevant branch — delete checklist, date/timezone, staff list, canon fields.
- BEFORE saying done: produce the COHERENCE PROOF block with real DB rows and named cross-page numbers.
- Applies to ANY change touching: a Postgres table, a hook, a metric, a date helper, a staff list, a delete path, or commission/close/attribution logic. No trigger words required.

This means every single request loads the audit rules in Core, whether or not the skill fires.

### 2. Broaden the skill's trigger description

Update `.agents/skills/system-change-audit/SKILL.md` frontmatter `description` field so retrieval fires on more neutral phrasings, not just bug-report language. New description covers:

- Any mention of changing, fixing, updating, removing, or deleting data, rows, records, metrics, or UI tied to shared data
- Any mention of tables (`intros_booked`, `intros_run`, `fv_scorecards`, `follow_up_queue`, `leads`, `staff`, `milestones`, `vip_sessions`)
- Any mention of metrics or concepts (close rate, commission, attribution, WIG, intros run, follow-up ownership, week grouping, active staff)
- Any of the existing bug-report phrases ("still showing," "doesn't match," etc.)

This roughly triples the surface area on which retrieval will pull the skill into context.

### 3. Re-apply the skill so the new description takes effect

Call `skills--apply_draft` with `.agents/skills/system-change-audit` after the description update.

## What this does NOT change

- No app code touched.
- No new memory files created — only the Core section of `mem://index.md` gains one bullet, and the existing skill's description is broadened.
- The `consumer-map.md` reference inside the skill stays as deep reference for when the skill loads.

## After this is applied

- Every request: the audit rules are in your context via Core memory. I cannot skip them.
- Most data/metric requests: the full skill loads automatically via the broader description.
- Edge cases (pure CSS tweak, copy change, unrelated UI): skill doesn't load, but Core rules still prevent me from claiming done without the proof block — so at worst I produce an unnecessary "no shared data touched, no proof needed" note, which is harmless.

## What still requires you

The only remaining manual lever is updating Settings → Project/Workspace Knowledge if you want the same rules echoed there for absolute belt-and-suspenders coverage. The Core memory edits above are sufficient on their own; the Settings layer is optional redundancy.