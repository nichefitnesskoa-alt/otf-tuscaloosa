## Problem

On the VIP Scheduler card (Pipeline → VIP tab), the "Attendance: N / Add Attendance" line reads `vip_sessions.actual_attendance` — a manually entered number that staff have to remember to log separately. But SAs are already logging per-person outcomes (`showed` / `booked_intro` / `purchased` / `no_show`) on each `vip_registrations` row from the MyDay VIP sheet. The two numbers drift, and Koa wants the card to reflect the live outcome-derived count automatically.

`VipPerformanceDashboard.tsx` already uses the canonical rule (outcomes in `showed`, `booked_intro`, `purchased` = attended; fallback to `actual_attendance` only if no outcomes are logged for the session). The Scheduler card just doesn't.

## Fix (scoped to `src/features/pipeline/components/VipSchedulerTab.tsx`)

### 1. Derive attendance from outcomes per session
- For each past `reserved` session in view, fetch `vip_registrations` rows (`id, vip_session_id, outcome, is_group_contact, attending_class`) once on mount (single batched `in('vip_session_id', [...])` query, not per-card).
- Add a helper `computeAttendedFromOutcomes(regs)` that counts registrations where `outcome IN ('showed','booked_intro','purchased')`. Group contacts who marked `attending_class = true` also count, matching how `isCountedAsMember` already treats them.
- Build a `Map<sessionId, { attended: number; anyOutcomeLogged: boolean }>`.

### 2. Replace the displayed value
- Render priority on the card line:
  1. If `anyOutcomeLogged` for the session → show `Attendance: <attended>` with a small "Auto from outcomes" sublabel, and an inline pencil that opens the existing manual override input (overrides write to `actual_attendance` as today, but the auto count keeps showing until outcomes change).
  2. Else if `actual_attendance != null` → show today's behavior unchanged (`Attendance: <n>` + Pencil).
  3. Else → today's "Add Attendance" button unchanged.
- Use the same "Auto-counted from outcomes" wording the Performance dashboard uses, so the two surfaces speak the same language.

### 3. Keep it live with MyDay
- Add a Supabase Realtime channel on `vip_registrations` filtered to the session IDs in view (or table-wide with a session-id filter in the handler) that refetches the outcome map on any insert/update/delete. This is how WIG/Coach View already mirror MyDay edits.
- Also invalidate / refetch on tab focus.

### 4. Keep manual override path intact
- `handleSaveAttendance` still writes `vip_sessions.actual_attendance` so historical sessions where outcomes were never logged keep working. The display just prefers outcomes when they exist.

## Cross-page coherence (must match after build)

For one chosen past reserved session:

| Surface | What it shows | Source |
|---|---|---|
| Pipeline → VIP Scheduler card | Attendance: N | NEW: outcomes-derived (this PR) |
| Performance dashboard tile "Total Attendees" | contributes N to the studio total | already outcomes-derived |
| MyDay VIP Registrations sheet "X showed / Y no-show" summary | matches N | already per-row outcomes |

All three must report the same N. If they don't, the build isn't done.

## Out of scope

- No DB migration.
- No change to `VipRegistrationsSheet` (outcome logging UI stays as-is).
- No change to `VipPerformanceDashboard` (already correct).
- No change to how `actual_attendance` is stored — it remains the override / legacy fallback only.

## Files touched

- `src/features/pipeline/components/VipSchedulerTab.tsx` only.

## Closing-line contract

Will close with COHERENCE PROOF naming a specific `vip_sessions.id`, the count of `vip_registrations` rows with attended outcomes for it, and confirmation that the Scheduler card, Performance dashboard, and MyDay sheet all display that same number.