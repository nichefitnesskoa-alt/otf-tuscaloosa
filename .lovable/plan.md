## Diagnosis (reach-map)

**Canonical sale helpers exist — will reuse, not redefine:**

- `SALE_CANONS` + `isSaleCanon` (src/lib/sales-detection.ts:20-32) — set is exactly `{SALE, PREMIER, PREMIER_OTBEAT, ELITE, BASIC}`. `ON_5_CLASS_PACK` is correctly excluded.
- `getRunSaleDate` (src/lib/sales-detection.ts:96) — fallback chain `buy_date > run_date > created_at`. This is what the new helper will use to bucket sales by close-week.
- `isPostDatedSale` / `isEffectiveSale` — future-dated buys excluded from current-week counts.

**Attribution source confirmed:** `intros_run` does NOT carry `intro_owner`. It must be read from the joined `intros_booked` row (column `intro_owner`). The hook will fetch runs and join their linked bookings, mirroring how `useSaLeadsBooked` joins `vip_sessions`.

**"Own It" location confirmed:** `src/pages/TheTable.tsx` (`/the-table`, bottom-nav label "Own It"). It is the weekly accountability/commitments page. There is currently no per-SA goals panel on it. We will add an **SA Weekly Goals** card at the top of TheTable, visible when the viewing user is an SA (role includes SA or Both, or Admin viewing their own).

**Old SA "lead measure" — CONFIRM THIS VALUE:** The only pre-existing per-SA-tab lead measure is the **studio-level "Total leads for [month]" input + the "Leads this period" tile** at the top of the WIG SA tab (`Wig.tsx:884-910`, fed by `monthly_lead_totals` and rendered by `renderMetricCard(leadCard, true)`). This is a manual OTF-report number, studio-wide (not per-SA). Per the prompt's own fallback: "If the old measure was only the manual monthly lead total tile, confirm that and archive accordingly." **My read: yes, this is what's being replaced for the SA WIG view.** Archive plan: move the input + tile behind a collapsed "Archived: manual monthly lead total (OTF report)" disclosure on the SA tab — UI hidden by default, expand to view/edit. **Zero data deleted; `monthly_lead_totals` table and all rows untouched.** If the user wants it removed from the SA tab entirely (and only kept on a Studio page), confirm.

**Reach-map of touched concepts:**


| Concept                   | Reads                                                                                     | Writes                                                          |
| ------------------------- | ----------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| SA leads booked           | `useSaLeadsBooked` → WIG SA leaderboard (built), Own It (new)                             | `intros_booked.created_at`, `vip_sessions.sa_setup_name`        |
| SA sales                  | `useSaSales` (new) → WIG SA leaderboard (new column + tile), Own It (new)                 | `intros_run.result_canon/buy_date`, `intros_booked.intro_owner` |
| Per-SA target             | `studio_settings:sa_sales_target:YYYY-MM` (new), `sa_leads_booked_target:YYYY-MM` (built) | WIG editors                                                     |
| Monthly studio lead total | `monthly_lead_totals` → SA tab tile (archive), nowhere else                               | manual input                                                    |


---

## Plan

### Part 1 — `src/lib/sa/salesBooked.ts` + `src/hooks/useSaSales.ts`

Mirror `leadsBooked.ts` shape exactly.

```ts
// salesBooked.ts
import { isSaleCanon, getRunSaleDate, isEffectiveSale } from '@/lib/sales-detection';

export interface SaSaleRunInput {
  id: string;
  result_canon: string | null;
  result?: string | null;
  buy_date: string | null;
  run_date: string | null;
  created_at: string;
  linked_intro_booked_id: string | null;
  deleted_at?: string | null;
  ignore_from_metrics?: boolean | null;
}
export interface BookingOwnerLite { id: string; intro_owner: string | null; }

export function isSaCountableSale(r: SaSaleRunInput): boolean {
  if (r.deleted_at || r.ignore_from_metrics) return false;
  if (!isSaleCanon(r.result_canon)) return false;
  return isEffectiveSale(r); // excludes post-dated future buys
}
export function getSaleCreditSa(r, bookingsById): string | null {
  if (!r.linked_intro_booked_id) return null;
  return bookingsById.get(r.linked_intro_booked_id)?.intro_owner?.trim() || null;
}
export function aggregateSalesBySa(runs, bookings) { /* uses getRunSaleDate, bucketed by CST */ }
```

```ts
// useSaSales.ts — same React Query / DATA_CHANGED_EVENT pattern as useSaLeadsBooked
// Fetch intros_run by created_at range AND buy_date range (union), then filter
// by getRunSaleDate ∈ [rangeStart, rangeEnd] CST. Join intros_booked by id IN
// (linked_intro_booked_id list) to read intro_owner.
// Invalidate scopes: ['intros_run','intros_booked','sa-sales']
```

### Part 2 — WIG SA table (`WigSaLeaderboard.tsx`)

- Add 3rd header tile **"Sales"** (period total, drillable) — keeps Leads tile + Milestones tile + adds Sales tile = 4 tiles in 4-col grid, or 2x2 on narrow.
- Add target-editor row for `sa_sales_target` (same UX as the existing leads-target editor; key `sa_sales_target:YYYY-MM`, default 1, persisted per period).
- Table columns in order: **SA | Leads (vs 4/wk) | Sales (vs 1/wk) | Milestones | Refs**. Sales cell shows count with `/1wk` suffix and same green/amber pacing as Leads.
- **Leads drilldown — VIP-creator breakdown:** group bookings by `lead_source`. VIP-class lines split into two rows when applicable: "VIP Class (set up by [SA])" using `vip_sessions.sa_setup_name` already returned by the helper, vs "VIP Class (set up by others)" for rows where the credited SA is *not* the sa_setup_name (shouldn't happen because VIP credit = sa_setup_name, but the label clarifies intent for the SA). Rows show member name + week label.
- **Sales drilldown:** per-SA member list with sale tier + close date.

### Part 3 — Archive old measure

- Wrap the monthly lead input Card + `leadCard` tile in a `<Collapsible>` titled **"Archived: manual monthly lead total (OTF report)"**, collapsed by default. Underneath, helper text: "Replaced by per-SA Leads Booked. Historical totals preserved."
- `monthly_lead_totals` table and existing rows: **untouched**. No migration. Still readable and editable via the disclosure.

### Part 4 — Own It SA Weekly Goals

Add a new component `src/components/table/SaWeeklyGoals.tsx`, rendered near the top of `TheTable.tsx` for users whose role includes SA / Both / Admin.

```
[June vision: Double last June's leads. 182 total.]

This week
  Leads Booked    3 of 4
  Sales           0 of 1
```

- Reads `useSaLeadsBooked(weekStart, weekEnd)` and `useSaSales(weekStart, weekEnd)` for **current CST Monday-week**, filtered to `rows.find(r => r.sa === user.name)`.
- Targets read from `studio_settings` keys above (same defaults).
- Copy: warm, short, no em dashes. e.g. "Two numbers this week. Four leads booked. One sale."
- Same canonical helpers as WIG → guaranteed identical numbers.

### Notes

- `notifyDataChanged` is already fired by VIP setup edits (`vip_sessions`, `sa-leads-booked`). Sales hook will also listen on `intros_run` writes (already broadcast across the app).
- No changes to Milestones, POS Refs, Coach WIG, or any role logic.
- `useActiveStaff` used for team-rollup target math.

---

## Coherence Proof (will produce)

1. Pick one SA. SQL hand-count their sales for week of 2026-05-25 → 2026-05-31:
  ```sql
   SELECT b.intro_owner, COUNT(*) FROM intros_run r
   JOIN intros_booked b ON b.id = r.linked_intro_booked_id
   WHERE r.deleted_at IS NULL AND r.result_canon IN ('SALE','PREMIER','PREMIER_OTBEAT','ELITE','BASIC')
     AND COALESCE(r.buy_date, r.run_date, r.created_at::date)
         BETWEEN '2026-05-25' AND '2026-05-31'
   GROUP BY b.intro_owner;
  ```
   Confirm `useSaSales` returns identical map.
2. ON_5_CLASS_PACK row → 0 contribution. Confirm.
3. A run with `run_date` last week + `buy_date` this week → lands this week. Confirm.
4. Open same SA in WIG and Own It → identical Leads/Sales numbers, side-by-side.
5. VIP breakdown sums = SA's VIP-sourced leads; lead-source rows sum = SA's total leads. Confirm.
6. `SELECT COUNT(*) FROM monthly_lead_totals` before vs after = unchanged. Confirm archived not deleted.

---

## CONFIRM THIS VALUE before I start

1. **Old measure = monthly_lead_totals tile on SA tab.** OK to wrap in a collapsed "Archived" disclosure on the SA tab (data preserved)? Or remove from SA tab entirely (still editable from somewhere else)?
2. **Own It placement:** new `SaWeeklyGoals` card at the top of `/the-table`, visible to users whose role includes SA / Both / Admin, scoped to the current CST week (not the meeting's `weekDate` stepper). OK?
3. **Vision line copy:** literally "Double last June's leads. 182 total." — June-only static, or stored in `studio_settings` for future months?  
  
  
1. Archive: yes, wrap the old PER-SA role. BUT the monthly lead
     total itself is the studio-level WIG target, not deprecated.
     Keep that number VISIBLE on the SA tab as studio context,
     relabeled "Studio goal: [N] leads this month," shown ABOVE the
     per-SA table. What's archived is its former role as the per-SA
     measure (now replaced by the Leads Booked column). Do not
     collapse the studio number out of sight. monthly_lead_totals
     untouched. Hierarchy: studio target on top, per-SA Leads +
     Sales table below.
  2. Own It placement: yes. SaWeeklyGoals card at top of /the-table,
     SA/Both/Admin, scoped to current CST week, NOT the meeting
     weekDate stepper. Approved.
  3. Vision line: store in studio_settings, NOT hardcoded. Key name
     your call (CONFIRM THIS VALUE), default "Double last June's
     leads. 182 total.", editable by Admin without a code change.
  Everything else in the plan approved. Build it, then full
  coherence proof including the run-week-vs-close-week test and the
  WIG-equals-Own-It side-by-side.