## Root cause

The missing-outcome banner is firing on Lauren, Manina, and Raegan even though their class is at **5:30 PM Central today** and it's only 3:43 PM.

Looked at the DB. `intros_booked.class_start_at` for all three rows is stored as `2026-07-06 17:30:00+00` — that's **5:30 PM UTC**, which is **12:30 PM Central**. So the banner code correctly sees "3+ hours elapsed since class start" and fires. The stored timestamp is wrong (should be `22:30:00+00` for a 5:30 PM CST class), but the banner is trusting it.

Two problems, one fix now:

1. **Banner (fix now):** `MyDayPage.tsx` prefers `class_start_at` when present, then falls back to computing local Central time from `class_date` + `intro_time`. Because `class_start_at` is mis-stored across the whole table, preferring it produces a class-time that's ~5 hours too early.
2. **Underlying data issue (flag, don't fix in this pass):** `class_start_at` is being written as if `intro_time` were UTC. That affects any other surface reading `class_start_at`. Should be its own audit.

## Plan

**Only file touched: `src/features/myDay/MyDayPage.tsx**`

In the `missingOutcomeBookings` memo (lines 191–220):

- Remove the `class_start_at` branch entirely.
- Always compute `startMs` from `class_date` + `intro_time` parsed as local (Central) time using the same pattern already in the file:
  ```
  const [y, m, d] = b.class_date.split('-').map(Number);
  const [hh, mm] = (b.intro_time || '00:00').split(':').map(Number);
  const startMs = new Date(y, m - 1, d, hh || 0, mm || 0).getTime();
  ```
- Keep the same `elapsed >= TWO_HR && elapsed <= SEVEN_DAYS` gate.
- Keep the same exclusions (deleted, cancelled, planning-reschedule, already-ran).

## Verification

- Query the three affected rows and confirm computed `startMs` = 5:30 PM Central today, elapsed is negative (~-1h 47m), so none appear in the banner.
- Confirm banner disappears in the preview.
- Confirm any legitimately-past intro from earlier today or the past week still shows.

## Not doing in this pass (calling out)

- Fixing the `class_start_at` write path. That field is wrong across the table and likely mis-feeds other surfaces (Coach View, WIG, etc.). Recommend a follow-up audit + backfill migration once you confirm you want it done as a separate change.  
  
Fix the class_start_at write path and make sure that doesn't happen again and make sure all other class times and times in general are in central time across all systems  
  
