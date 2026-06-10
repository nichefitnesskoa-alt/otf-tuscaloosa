# WIG Redesign — Pace-to-Today, Leaderboard Up, Adjustable Monthly Targets

## Diagnose first — where targets currently live (all must convert to monthly settings)

| Surface | File | Current target source | Fix |
|---|---|---|---|
| WIG hero (studio leads) | `src/pages/Wig.tsx` | `studio_settings.wig_lead_target:YYYY-MM`, fallback global, fallback hardcoded `240`. "On pace for ~X" computed inline. Close-rate target hardcoded `40`. | Hero becomes **team SGL** (per-SA × active SAs). Studio total moves to small context line. Close-rate target → monthly setting. Delete the 240 fallback. Delete projection. |
| SA leaderboard | `src/components/wig/WigSaLeaderboard.tsx` | `sa_leads_booked_target:YYYY-MM` and `sa_sales_target:YYYY-MM`. "On pace ✓/behind pace" inline math. No SGL column — only Booked + Sales. | Add **SGL/Leads column** (from `useSaLeads` / canonical helper) with mini-bar vs `sa_sgl_target:YYYY-MM`. Sort by SGL desc. R/Y/G via shared helper. Drop inline pace math; call `paceToToday()`. |
| Own It SaWeeklyGoals | `src/components/table/SaWeeklyGoals.tsx` | Reads `sa_leads_booked_target:YYYY-MM` default 16, derives **weekly slice = round(monthly/4)** ("goal of 17" comes from monthly 16 → weekly 4, but the leads tile shows `weeklyLeadsSlice`). Sales has `sa_sales_target:YYYY-MM` default 1 — **labeled monthly but treated weekly**. | Make all three goals monthly with pace-to-today display. Add `sa_sgl_target` for SGL. Remove `/4` weekly slicing. Same helper, same colors. |
| Coach close-rate | nowhere persisted | hardcoded `40` in Wig.tsx | New setting `coach_close_rate_target:YYYY-MM`. |

No other surfaces (Studio/Recaps Per-SA, MyDay) carry their own target literal — they show counts only. Confirmed via grep.

## New canonical primitives

**`src/lib/wig/targets.ts`** — settings keys + loader
- Keys: `sa_sgl_target:YYYY-MM`, `sa_leads_booked_target:YYYY-MM`, `sa_sales_target:YYYY-MM`, `coach_close_rate_target:YYYY-MM`, `studio_leads_target:YYYY-MM` (renamed from `wig_lead_target`, with one-time read-through).
- `loadMonthlyTargets(ym)` → `{ saSgl, saBooked, saSales, coachClose, studioLeads }` each `number | null`. Null = unset → UI shows "CONFIRM THIS VALUE", never substitutes.
- `saveMonthlyTarget(key, ym, value)` writes and invalidates.

**`src/lib/wig/pace.ts`** — one helper, used everywhere
```ts
export function paceToToday(monthlyTarget: number | null, on: Date = nowCentral()): number | null
// returns monthlyTarget * (daysElapsed / daysInMonth) using America/Chicago.
export function statusColor(current: number, paceToToday: number | null): 'green'|'yellow'|'red'|'unset'
// green: current >= pace; yellow: current >= pace*0.8; red: below; unset: pace null.
```
Inline projection math (`projected = (totalLeads/daysElapsed)*totalDays`) deleted everywhere.

**Team target** = `saSgl * activeSalesAssociates.length` from `useActiveStaff()`. Never literal.

## SA tab layout (top → bottom)

1. **HERO — Team Self-Generated Leads** (loud bar, R/Y/G vs team pace-to-today). Big number `sum(SGL)` / team target. Context line: `Studio leads: {totalLeads} / {studioLeadsTarget} (about half paid)`. Edit-target affordance for Admin only.
2. **SA Leaderboard table** (pulled up from Studio tab). Columns: Rank · SA · **Leads (SGL) + mini-bar** · Booked · Sales. Sort by SGL desc. Each cell colored R/Y/G against that SA's pace-to-today. Keep clarifier line.
3. Below the fold: `SelfSourcedLeadEntry`, `SourcedLeadsToText`, conversion funnel, milestones.

## Coach tab

- Hero bar gets R/Y/G against `coach_close_rate_target` pace-to-today (close-rate target is a flat % — pace = target itself, no day proration; R/Y/G simply compares current % to target with same 80% yellow band).
- Coach stats table sorted by close % desc, mini-bar in close-% cell, row tint R/Y/G. Keep total-journey disclaimer.

## SGL/sales helper coherence

- `useSaLeaderboard` already supplies sales via `salesBooked.ts`. SGL column must call canonical `leadsBooked.ts` helper. If `useSaLeaderboard` doesn't expose SGL, extend it (single hook, single source) — do not recompute in component.
- `SaWeeklyGoals` switches to the same `useSaLeads`/`useSaSales` hooks already in use and the same `targets.ts` loader.

## Files

**New**
- `src/lib/wig/pace.ts`
- `src/lib/wig/targets.ts`

**Edit**
- `src/pages/Wig.tsx` — new hero, mount leaderboard under hero, move actions below, delete projection, delete hardcoded 240/40, read targets via `targets.ts`. Move SA leaderboard mount from Studio tab → SA tab top.
- `src/components/wig/WigSaLeaderboard.tsx` — add SGL column + mini-bar, sort by SGL, share `paceToToday`/`statusColor`, drop inline pace strings, switch target reads to `targets.ts`.
- `src/components/table/SaWeeklyGoals.tsx` — monthly model with pace-to-today, add SGL tile, drop `/4` slicing.
- `src/hooks/useSaLeaderboard.ts` — add SGL aggregation from `leadsBooked.ts` if not already present.

**Migration** — none. New setting keys are just new rows in existing `studio_settings`. Read-through from legacy `wig_lead_target:*` preserved one cycle.

## Out of scope
SGL definition, sale set, WIGs, lead measures, role permissions, scoring formulas, Studio tab content other than relocating leaderboard mount.

## Coherence proof I'll run before closing
- Change `sa_leads_booked_target:2026-06` from 10 → 12 in `studio_settings`: hero team target, leaderboard mini-bar denominator, pace number, row color, and Own It tile all move. Verified via `read_query`.
- Pick one SA (Kaiya): Leads / Booked / Sales identical on WIG leaderboard, Studio Per-SA, Own It.
- `sum(leaderboard.SGL) === hero.teamSGL`.
- Pace uses CT today + June day count.
- An SA at/above today's pace renders green.
- Grep confirms no remaining hardcoded target literals (240, 40, 17, 91, 182 in target contexts).
