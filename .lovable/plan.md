## Goal
When an admin overrides one SA's individual goal, automatically redistribute the remaining shortfall across the other non-overridden SAs so the team totals still equal the overall monthly goal — in both the **SOML** section and the **overall SA leads** section on WIG.

## Behavior change

Today:
- SOML: every SA's default = `totalGoal / activeCount`. Overriding Jayna to 0 leaves everyone else at 1.7 → team target only sums to 8.5, not 10.
- WIG leads: overriding one SA below the per-SA target lowers the team target (team = sum of effective per-SA). Overrides do not push the remaining SAs' targets up.

After:
- Treat the overall goal as **fixed**:
  - SOML: `soml_config.{referrals,upgrades,sales}_goal` = fixed team goal per metric.
  - WIG leads: fixed team leads goal = `saSgl × activeCount` at the moment the admin sets it (i.e. the global per-SA target × active count is the team goal; individual overrides no longer change the team goal).
- **Redistribute remaining goal** across non-overridden SAs:
  - `remaining = max(0, teamGoal − Σ overrides)`
  - `nonOverriddenCount = activeCount − #overrides`
  - `newDefault = nonOverriddenCount > 0 ? remaining / nonOverriddenCount : 0`
- Overridden SAs keep exactly their custom number; non-overridden SAs display and pace against `newDefault` (not the raw `totalGoal / activeCount`).
- If overrides already meet or exceed the team goal, non-overridden SAs get target `0` (with a subtle "covered by overrides" hint).

## Files to change

1. **`src/features/wig/soml/SomlSection.tsx`**
   - Replace the current `defaultPerSa` calc with a redistribution that subtracts sum-of-overrides per metric and divides by non-overridden SA count.
   - Update the "Default per-SA target: …" caption to reflect the redistributed number and note when it was auto-adjusted (e.g. `1.7 → 2.0 (auto-adjusted for overrides)`).
   - Leaderboard rows already use `effectiveTarget(sa, metric)`; the redistributed default flows through unchanged.

2. **`src/components/wig/WigSaLeaderboard.tsx`**
   - Treat `teamSglTarget` as fixed = `targets.saSgl × activeCount` (not sum of effective per-SA).
   - Change `effectiveSaSglTarget(sa)`:
     - If override exists → override value.
     - Otherwise → `(teamSglTarget − Σ overrides) / nonOverriddenCount` (clamped ≥ 0).
   - Update the hero footer copy so `Per-SA: X × N SAs` still makes sense — show the redistributed default for non-overridden SAs and a `(N overridden)` hint when any exist.

## Out of scope
- No DB changes. Overrides and totals already live in `soml_sa_goals`, `soml_config`, `monthly_lead_totals`, and the per-SA override table used by `loadPerSaOverrides`.
- Booked/Sales columns on the WIG leaderboard have no per-SA override mechanism today, so no redistribution needed there.
- Coach/Studio-wide tiles unaffected.

## Coherence proof I'll produce after building
- SOML: with sales goal = 30 and Jayna override = 0, verify each remaining SA shows `6.0` and team goal reads `30`.
- WIG leads: with per-SA leads = 5 and Jayna override = 0 (6 SAs → team goal 30), verify remaining 5 SAs show `6` each and hero team target stays `30`.
- Confirm overridden SAs display their override untouched, and clearing an override restores the flat default across all SAs.
