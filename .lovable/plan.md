# Monthly Net Gain Goal + Own It Slide Deck

## Part 1 — Editable Monthly Net Gain Goal

**New table:** `monthly_net_gain_goals`
- `id uuid pk`, `month_key text unique` (format `YYYY-MM`, America/Chicago), `goal integer not null`, `created_by text`, `created_at`, `updated_at`
- RLS: authenticated read; write gated to Koa (admin identity) via app-layer check + policy allowing authenticated writes (matches existing patterns like `net_gain_state`).
- Grants: `SELECT, INSERT, UPDATE` to `authenticated`, `ALL` to `service_role`.

**New hook:** `src/hooks/useMonthlyNetGainGoal.ts`
- `useMonthlyNetGainGoal(monthKey?)` — returns `{ goal, monthKey }` for current CT month by default.
- `useSetMonthlyNetGainGoal()` — upsert mutation, invalidates `['monthly-net-gain-goal', monthKey]`.

**UI surfaces (single canonical component):**
- New `src/components/wig/NetGainGoalEditor.tsx` — displays "Goal: {n}" with `InlineEditField` (Koa only, read-only for everyone else via `isKoa(user)`).
- Mount on WIG Net Gain tile (existing net gain display) and reuse inside the Own It slide.

## Part 2 — Own It Live Slide Deck

**Entry point:** New button in `src/pages/TheTable.tsx` (Own It tab) header — "Present Deck" — opens fullscreen React slide viewer. Live data, keyboard nav (←/→/Esc), 1920×1080 scaled to viewport per slides-app skill.

**New files:**
- `src/features/ownItDeck/OwnItDeckPage.tsx` — fullscreen container, scaling, keyboard nav, slide index in URL (`?slide=N`).
- `src/features/ownItDeck/ScaledSlide.tsx` — 1920×1080 canvas wrapper.
- `src/features/ownItDeck/useDeckData.ts` — single hook that fans out to all data hooks (net gain, SGL/non-SGL funnels, SOML, WIG leads, coach close %, individual coach stats, action items, owner commitments) for current CT month + current meeting.
- `src/features/ownItDeck/slides/` — one component per slide (9 slides).
- Route: `/the-table/deck` (protected, admin/coach).

**Slide order (fixed per user):**
1. `Slide01_NetGainVsGoal` — big number: current `net_gain_state.value` vs monthly goal, delta, pace line.
2. `Slide02_SglFunnel` — MTD leads → booked → showed → sold, filtered by `isSglLeadSource`. Uses `useDashboardMetrics` / existing SGL selectors.
3. `Slide03_NonSglFunnel` — same funnel, filtered by `NON_SGL_SOURCES`.
4. `Slide04_SomlStats` — pulls `useSomlData` + `soml_sa_goals` to show per-SA on-track/behind.
5. `Slide05_WigLeadsStats` — WIG lead-source performance from `useLeadMeasures` / lead-source drilldown, on-track flags.
6. `Slide06_CoachCloseRate` — overall coach close % (first-intro Total Journey) vs studio goal from `studio_settings`.
7. `Slide07_IndividualCoachStats` — per-coach internal (5 lead measures from `fv_scorecards` + close %) and OTF corporate benchmarks; one row per active coach.
8. `Slide08_ActionItemsOpen` — `useActionItems` filtered to open/in_progress across all meetings, grouped by owner.
9. `Slide09_OwnerCommitments` — every active non-architect owner from `useActiveOwners` × current meeting `useOwnerEntries`: submitted commitment text OR "Not submitted" chip; visually flags gaps.

**Period basis:** Current calendar month in America/Chicago for all monthly metrics; current meeting for action items + owner commitments.

**Design:** Dark OTF theme, PP Right Grotesk, semantic slide type classes (`.slide-title`, `.slide-body`, etc.) per slides-app skill. OTF Orange for accents, big stat callouts (72-120pt), one metric focus per slide. Header shows "OWN IT — Week of {Mon DD}" and slide N/9.

**Data source reuse (no new business logic):**
- Net gain: existing `net_gain_state` + new goal table.
- SGL/non-SGL: `isSglLeadSource` + existing dashboard hooks.
- SOML: `useSomlData`, `soml_sa_goals`.
- WIG leads: existing WIG hooks.
- Coach close %: existing coach performance selectors (Total Journey).
- Individual coach stats: `useFvTrendData` + close %.
- Action items: `useActionItems`.
- Owner commitments: `useActiveOwners` + `useOwnerEntries` for current meeting.

## Files Touched / Created
- **New DB migration:** `monthly_net_gain_goals` table + grants + RLS.
- **New:** `src/hooks/useMonthlyNetGainGoal.ts`, `src/components/wig/NetGainGoalEditor.tsx`, `src/features/ownItDeck/*` (page, ScaledSlide, useDeckData, 9 slide components, index).
- **Edited:** `src/pages/TheTable.tsx` (Present Deck button), `src/App.tsx` (new route), WIG net gain surface (mount goal editor).

## Out of Scope
- Downloadable .pptx file (user chose live in-app only).
- Editing goal from anywhere but WIG + deck slide.
- Broadcast/presenter view.
