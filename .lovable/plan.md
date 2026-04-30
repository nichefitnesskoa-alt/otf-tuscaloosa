## Problem

When you open **Send Script** from the VIP Registrations sheet (a VIP attendee like Jerica), the rendered script shows:

- `[Time]` and `[Day]` instead of the actual VIP class date/time
- The wrong coach name — it falls back to the logged-in SA's name (or `[Coach name]`) instead of the coach assigned to that VIP class

## Root Cause

There are two separate bugs, both in how `ScriptSendDrawer` is invoked from VIP surfaces.

### Bug 1 — Date/time merge fields are hard-coded to placeholders

In `src/components/scripts/ScriptSendDrawer.tsx` (`resolveMergeFields`), `{day}`, `{today/tomorrow}`, and `{time}` are unconditionally replaced with the literal strings `[Day]` and `[Time]`:

```ts
resolved = resolved.replace(/\{today\/tomorrow\}/gi, '[Day]');
resolved = resolved.replace(/\{day\}/gi, '[Day]');
resolved = resolved.replace(/\{time\}/gi, '[Time]');
```

The drawer never accepts or formats real class date/time. So even though `buildScriptContext` knows how to format these, the drawer never uses it. Every caller (VIP, New Leads, Coach My Intros, etc.) shows `[Time]` / `[Day]`.

### Bug 2 — Coach name falls back to the logged-in user

In the drawer:

```ts
const genericCoachFull = firstIntroCoachFull || saName || null;
...
resolved.replace(/\{coach-name\}/gi, genericCoachFull || '[Coach name]');
```

When `VipRegistrationsSheet` opens the drawer for a VIP attendee, it passes **no `bookingId`** and **no `coachContextFallback`**. So:

1. `firstIntroCoach` resolution returns `null` (no booking).
2. `{coach-name}` falls through to `saName` — the logged-in SA. That's why every VIP script reads "This is Koa at OrangeTheory" regardless of which coach is actually running the VIP class.

The VIP session already stores the assigned coach in `vip_sessions.coach_name` (loaded into `vipCoach` state in the sheet), but it's never passed to the drawer.

## Fix

### 1. Make `ScriptSendDrawer` accept real class date + time and format them

Add two optional props:

```ts
classDate?: string | null;   // ISO 'YYYY-MM-DD'
classTime?: string | null;   // 'HH:MM' or 'HH:MM:SS'
```

In `resolveMergeFields`, replace the hard-coded placeholders with formatted values when provided (Central Time aware), reusing the same logic already in `src/lib/script-context.ts`:

- `{day}` → `format(parseISO(classDate), 'EEEE, MMMM d')` (e.g. "Saturday, May 9")
- `{today/tomorrow}` → `'today'` / `'tomorrow'` / weekday name, computed against America/Chicago
- `{time}` → 12-hour with AM/PM (e.g. "9:00 AM")

If `classDate` / `classTime` are not provided, fall back to the current `[Day]` / `[Time]` placeholders so existing callers don't regress.

Use `date-fns-tz` or the existing Central Time helpers in `src/lib/time/timeUtils.ts` to anchor "today/tomorrow" to America/Chicago (per project rule).

### 2. Pass the VIP coach + session date/time from `VipRegistrationsSheet`

In `src/features/myDay/VipRegistrationsSheet.tsx`:

- Extend the `vip_sessions` select to include `session_date` and `session_time` (already exists in schema).
- Store them in component state alongside `vipCoach`.
- When opening `ScriptSendDrawer`, pass:
  ```tsx
  coachContextFallback={vipCoach}
  classDate={vipSessionDate}
  classTime={vipSessionTime}
  ```

This makes `{coach-name}` / `{coach-first-name}` / `{first-intro-coach-name}` all resolve to the assigned VIP class coach (via the existing `coachContextFallback` path in the drawer), and `{day}` / `{time}` resolve to the VIP class date/time.

### 3. Audit other callers (no behavior change required)

Quick check on the four other call sites — all already pass `coachContextFallback` correctly OR are in contexts where the existing fallback is right:

- `CoachMyIntros.tsx` — passes `bookingId`, coach resolved from booking chain ✓
- `NewLeadsAlert.tsx` — no booking yet, coach unknown, fallback to `[Coach name]` is correct
- `VipClaimBanner.tsx` — verify it passes the claiming coach (will confirm during build and pass `coachContextFallback` if missing)
- `ShiftChecklist.tsx` — generic shift scripts, no specific coach context

For any caller that has class date/time available (e.g. `CoachMyIntros`), pass the new `classDate` / `classTime` props so `{day}` and `{time}` render correctly there too.

## Files to Change

- `src/components/scripts/ScriptSendDrawer.tsx` — add `classDate` + `classTime` props, format them in `resolveMergeFields` using Central Time
- `src/features/myDay/VipRegistrationsSheet.tsx` — fetch + pass `session_date`, `session_time`, and `vipCoach` to the drawer
- `src/pages/CoachMyIntros.tsx` — pass `classDate` + `classTime` from each booking to the drawer
- `src/features/myDay/VipClaimBanner.tsx` — confirm coach is passed; pass session date/time

## Downstream Effects

- VIP scripts now render real day/time and the assigned VIP coach's name everywhere the VIP drawer is opened.
- Coach My Intros scripts (1st intro, 2nd intro, post-class) now render real class day/time.
- No data-model changes; no migrations.
- No role-permission changes.
- Existing callers that don't pass the new props keep current `[Day]` / `[Time]` behavior — zero regression.

## What I Will NOT Change

- The `buildScriptContext` function and other script-generation paths
- Any database schema, RLS, or edge functions
- Any UI outside the drawer + the four caller files listed above
