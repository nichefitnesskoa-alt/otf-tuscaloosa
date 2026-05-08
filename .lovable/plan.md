## What's broken

**VIP page top stats (`VipPerformanceDashboard`)**
- "Total Attendees" reads `vip_sessions.actual_attendance` — a manual number that's no longer being entered. SAs now log per-registrant outcomes on the group VIP card (`showed` / `booked_intro` / `purchased` / `no_show`) in `vip_registrations.outcome`, but nothing counts them.
- "Joins from VIP" only counts `intros_run.result_canon = 'SALE'` linked to a VIP-tagged booking. The 2 people who joined straight from VIP (logged as `purchased` on the registration, no intro path) never get counted.

**BottomNav** — Pipeline tab is Admin-only; SAs lost it.

## Plan

### 1. Rewrite `VipPerformanceDashboard` metrics to use registration outcomes

Pull `vip_registrations` for the quarter (joined to `vip_sessions` for date filter, excluding archived sessions and registrations with `is_organizer = true`). Compute:

- **VIP Classes This Quarter** — unchanged (sessions reserved/completed in range).
- **Total Attendees** — count of registrations where `outcome IN ('showed','booked_intro','purchased')`. Drop the "Manual attendance logged" sublabel; replace with "Auto-counted from outcomes".
  - Fallback: if a session has zero outcomes logged but has `actual_attendance` set, still use that legacy number so old data doesn't disappear.
- **Intros Booked from VIP** — union of:
  - `vip_registrations.outcome = 'booked_intro'` count, plus
  - any `intros_booked.vip_session_id` rows not already represented (covers manual bookings created outside the registration flow).
  - De-dupe by person name + session to avoid double counting.
- **Joins from VIP** — union of:
  - `vip_registrations.outcome = 'purchased'` (direct joins), plus
  - VIP-tagged `intros_booked` whose linked `intros_run.result_canon = 'SALE'` (intro-path joins).
  - De-dupe by person.

### 2. Restore Pipeline for SAs in `BottomNav`

Add `/pipeline` to the non-admin nav array. Final SA tabs: My Day · WIG · Pipeline · VIPs (4 items, still fits the bottom bar at 1167px and mobile).

Coaches keep their current condensed nav (no change requested).

## Files to change

- `src/features/vips/VipPerformanceDashboard.tsx` — rewrite `fetchMetrics` to read `vip_registrations.outcome`, with legacy `actual_attendance` fallback and dedupe logic for joins/intros.
- `src/components/BottomNav.tsx` — add Pipeline to the SA `visibleItems` array.

## Out of scope

- Removing the manual `actual_attendance` input from `VipSchedulerTab` — leaving it as an override/legacy field. Say the word and I'll hide it.
- Changing `VipClassPerformanceTable` (admin per-class table) — it already prefers `actual_attendance` then falls back to registration count; can switch it to outcome-based in a follow-up if you want it consistent.
