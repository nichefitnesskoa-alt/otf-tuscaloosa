# Drift Alert — Detail Differences + Offer Fixes

Today the "Metrics disagree" card just shows totals (Scoreboard 24 / Per-SA 24 / Funnel 21) and a drift number. You still have to investigate which booking caused the gap. This plan upgrades the alert to **name the offending records and offer one-click fixes**.

## What changes

`src/components/dashboard/MetricsConsistencyAlert.tsx` becomes a true diagnostic panel.

### 1. Compute per-booking source membership

For the selected date range, build three sets of booking IDs (one per source) using the same logic each surface uses:

- **Scoreboard set** — booking IDs counted in `metrics.studio.introsRun` (ran intros for the period)
- **Per-SA set** — booking IDs in `metrics.perSA` aggregations
- **Funnel set** — booking IDs flowing into `computeFunnelBothRows` `showed` totals (first + second)

Diff the sets to produce three lists:

- In Scoreboard + Per-SA but **NOT Funnel** (the 3 missing rows in your screenshot)
- In Funnel but not Scoreboard
- In Per-SA but not Scoreboard (attribution drift)

Same diffing for `sales`.

### 2. Show offenders inline

Replace the static "Drift — Ran: 3" footer with a collapsible list:

```text
Missing from Conversion Funnel (3)
  • Jessica Smith — 5/12 — owner: Bri — reason: originating_booking_id points to deleted parent
    [View booking] [Promote to 1st intro] [Clear originating link]
  • Marcus Lee   — 5/18 — owner: Alex — reason: linked run on soft-deleted booking
    [View booking] [Restore parent] [Mark run excluded]
  • …
```

Each row shows:
- Member name, class date, intro owner
- **Why** it drifts (computed from the same predicates `computeFunnelBothRows` uses: excluded booking, missing intro_owner, orphan chain, VIP flagged, etc.)
- **Suggested fix buttons** scoped to that reason

### 3. Fix actions (additive, reversible)

Each action is a single-row update with an audit note; nothing destructive.

| Reason | Fix button(s) |
|---|---|
| Orphan: `originating_booking_id` → deleted/missing parent | **Promote to 1st intro** (clears `originating_booking_id`) · **Open parent** |
| Missing `intro_owner` | **Assign owner…** (opens staff picker, defaults to `booked_by`) |
| Run linked to soft-deleted booking | **Re-link run…** (booking picker) · **Exclude run** (`ignore_from_metrics = true`) |
| VIP flagged but counted elsewhere | **Toggle VIP** |
| Soft-deleted but still in Scoreboard | **Confirm delete** (sets `booking_status_canon = DELETED_SOFT`) |

All writes go through existing mutation hooks; no new edge functions.

### 4. Helper extraction (per workspace coherence rule)

Extract the booking-set computation into `src/lib/metrics/sourceMembership.ts`:

```ts
export function computeSourceMembership(
  introsBooked, introsRun, dateRange,
): { scoreboard: Set<string>; perSA: Set<string>; funnel: Set<string>; perBookingReason: Map<string, DriftReason> }
```

This becomes the single source of truth for "which booking is in which surface" and can be reused by future audits.

## Files touched

- `src/components/dashboard/MetricsConsistencyAlert.tsx` — expanded UI, diff rendering, fix buttons
- `src/lib/metrics/sourceMembership.ts` — **new** canonical helper
- `src/components/dashboard/ConversionFunnel.tsx` — export the booking-ID set it builds (small refactor so the helper can consume it without duplicating logic)
- `src/hooks/useDashboardMetrics.ts` — expose the Scoreboard/Per-SA booking ID sets it already iterates over (no logic change)

No DB migrations. No changes to metric definitions — only surfacing what already exists and providing remediation shortcuts.

## Out of scope

- Changing how any of the three sources count (keeps current Scoreboard/Per-SA/Funnel definitions intact)
- Bulk fixes — every action is per-row and reversible
- Historical audit log UI (writes still go through existing audit fields)
