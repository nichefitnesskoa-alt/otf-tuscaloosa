## The Problem

Jasmine Beamon's 4/1 intro shows "TBD" on the WIG even though Natalya clearly ran the class. The drill-in shows Natalya because that view reads `intros_run.coach_name`. The WIG "Coach Performance" table reads `intros_booked.coach_name` — which was never updated when the run was logged.

## Root Cause

When an SA logs an intro outcome, the coach is saved to `intros_run.coach_name`. The matching `intros_booked.coach_name` row is only patched if (a) the SA went through `OutcomeDrawer` recently and (b) the booking coach was empty/TBD at save time. Older rows, rows logged via other paths (InlineIntroLogger, ClientJourneyPanel, IntroRunEntry, mobile flows), and any backfilled history were never synced.

Result: a coach IS attached to the run, but the booking still says "TBD" — so every metric anchored to `intros_booked.coach_name` (WIG Coach Performance, Per-Coach close rate denominator, TBD lists) silently undercounts that coach.

## Scope of Damage

A query against the database returned **30+ bookings** going back to February 2026 where:
- `intros_booked.coach_name` is `'TBD'`, empty, or null
- `intros_run.coach_name` has a real coach (Natalya, Elizabeth, Bre, Koa, James, Nathan, Kaitlyn H, Premier, etc.)

These coaches are losing credit for "Intros Coached" in the WIG every month.

## The Fix (Three Parts — All Built In One Pass)

### 1. One-Time Backfill Migration

For every `intros_booked` row where `coach_name` is null/empty/TBD AND a linked `intros_run` row has a real coach name, copy the run's coach into the booking. Audit fields:
- `last_edited_by = 'System (Coach Backfill)'`
- `edit_reason = 'Backfilled from linked run coach_name'`
- `last_edited_at = now()`

Skip soft-deleted bookings.

### 2. Database Trigger — Auto-Sync Going Forward

Add an `AFTER INSERT OR UPDATE` trigger on `intros_run`. Whenever `coach_name` is set to a non-empty, non-TBD value AND the linked booking's `coach_name` is null/empty/TBD, patch the booking. This eliminates the recurrence — no app code can forget to sync because the database does it.

```text
intros_run.coach_name set ──► trigger ──► intros_booked.coach_name updated
                                          (only if booking coach was missing)
```

### 3. WIG Query Hardening (defense in depth)

Update `src/pages/Wig.tsx` coach measures and `src/components/dashboard/PerCoachTable.tsx` so when `intros_booked.coach_name` is null/empty/'TBD', they fall back to the linked `intros_run.coach_name`. This protects against any future code path that bypasses the trigger.

## Downstream Effects (all addressed in this build)

- WIG → Coach Performance table: Natalya, Elizabeth, Bre, Koa, etc. immediately get correct "Intros Coached" counts for past months
- WIG → Per-Coach close rate: denominators correct, close rates recalculate
- Pipeline → coach displays: row cards stop showing "TBD" for these clients
- TBD-coach enforcement (built last build): the "no coach on file" warning stops triggering for these resolved bookings
- Drill-in views already showed the right coach — now they match the WIG

## Files Touched

- New migration: backfill SQL + trigger function + trigger
- `src/pages/Wig.tsx` — fallback to run coach when booking coach is missing
- `src/components/dashboard/PerCoachTable.tsx` — same fallback in `resolveCoach`

## What Will NOT Change

- Existing UI, layouts, navigation, role permissions
- Any flow where `intros_booked.coach_name` already has a real value (trigger only fills gaps, never overwrites)
- VIP attribution logic (vip_session coach precedence preserved)
- Manual coach edits via Pipeline edit dialog (those still win — trigger only fills missing values)

## Verification After Deploy

1. Re-query the "TBD with run coach" list — should return 0 rows
2. Open WIG → Coach Performance for March/April — Natalya/Elizabeth/Bre counts should jump
3. Insert a new run with coach_name on a TBD booking — confirm booking auto-updates
4. Confirm Jasmine Beamon's 4/1 intro now credits Natalya in the WIG