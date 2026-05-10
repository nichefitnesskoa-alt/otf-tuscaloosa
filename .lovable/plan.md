7 days feels right  
  
Fix: VIP group cards missing from My Day

## What's happening

Hemline Tuscaloosa's VIP class is on **Mon May 11 at 8:45 AM** with `status='reserved'`. The data is correct — the card is being filtered out by the date range.

My Day's "Upcoming Intros" card uses `timeRange='weekFull'`, which is defined as:

```
start = today
end   = endOfWeek(today, { weekStartsOn: Monday })  // → Sunday
```

Today is **Sunday May 10**, so the range collapses to `May 10 → May 10`. Tomorrow's VIP (May 11) is technically next week, so it's excluded — for both regular intros and VIP sessions. Every Sunday, My Day goes blind to anything Mon–Sat of the upcoming week.

## Fix (scoped, additive)

Two coordinated changes in `src/features/myDay/useUpcomingIntrosData.ts`:

### 1. Extend `weekFull` to never return less than 7 days ahead

Change `getDateRange` for `'weekFull'`:

```text
start = today
end   = max( endOfWeek(today, Mon), today + 6 days )
```

This keeps Mon–Sat behavior identical (still ends on the upcoming Sunday) but on Sunday rolls forward through next Saturday. Same fix benefits regular intros and VIP groups simultaneously — single source of truth, no new branch.

### 2. VIP sessions: always lookahead at least 7 days

Independent of timeRange, VIP groups are sparse and operationally critical (they drive prep). In the VIP fetch block (lines ~431–439), compute `vipEnd = max(rangeEnd, today + 6 days)` so a VIP group within the next week always shows on My Day even if the user is on the "Today" tab.

Regular intros stay scoped to the chosen range (no behavior change for SAs filtering by Today).

## Coherence check

Surfaces touched / verified:

- `useUpcomingIntrosData` → `UpcomingIntrosCard` (My Day) — Hemline VIP appears tomorrow ✓
- `MyDayPage` passes `fixedTimeRange='weekFull'` — unaffected for Mon–Sat, fixed for Sun
- `useWinTheDayItems` — separate query (today only), not affected, intentionally
- VIP day grouping in `IntroDayGroup` — already supports VIP-only days ("+N VIP groups" badge)

## Verification

- On Sun May 10, My Day shows Hemline Tuscaloosa VIP card under "Tomorrow / Mon May 11 · 8:45 AM"
- On Mon–Sat, weekFull range is unchanged (regression check: same start/end as before)
- VIP groups within next 7 days appear even when user toggles to "Today" tab
- `needsOutcome`, `restOfWeek`, `today` time ranges unchanged

## Files to edit

- `src/features/myDay/useUpcomingIntrosData.ts` (only)

## Open question

**Confirm the lookahead window**: 7 days feels right (full week visibility from any day). Want it longer (e.g. 14 days) so you can prep further out, or strict 7?