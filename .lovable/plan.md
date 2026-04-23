

## Goal

Rewrite the VIP outcome roll-up so the math is intuitive and accountable:
**"15 registered → 13 showed (2 no-show) · of the 13 who showed, 4 booked an intro"**

Today's line `9 showed · 4 booked intro · 2 no-show` reads like 9+4+2=15, but "Booked intro" attendees also physically showed — so showed should be 13, not 9. The flat tally double-decks the buckets.

## Root cause

`VipRegistrationsSheet.tsx` builds `outcomeBreakdown` as a flat count of each `outcome` value ('showed', 'no_show', 'booked_intro', 'purchased') joined by `·`. The four outcomes are treated as mutually exclusive even though three of them (`showed`, `booked_intro`, `purchased`) all imply the person physically attended. Only `no_show` is a true non-attendance state.

## Change

### `src/features/myDay/VipRegistrationsSheet.tsx`

Replace the flat `outcomeBreakdown` with a two-line summary derived from the same `regs` array — no schema change, no new data, no new outcome values.

Logic:
- `noShow` = count of `outcome === 'no_show'`
- `attended` = count of `outcome IN ('showed', 'booked_intro', 'purchased')`
- `bookedIntro` = count of `outcome IN ('booked_intro', 'purchased')` (a purchase implies they also booked/ran)
- `unlogged` = count where `outcome IS NULL`

Display inside the existing white summary card, replacing the single "9 showed · 4 booked intro · 2 no-show" line:

```
13 showed · 2 no-show
Of those 13 who showed → 4 booked an intro
```

If `unlogged > 0`, append a small muted note: `· N still need outcome logged`.
If no outcomes are logged yet, hide the breakdown lines (current behavior).

The big `15 people registered` headline stays exactly as-is. The per-attendee list, coach picker, Book Intro hand-off, and database writes are untouched.

## Files touched

- Modified: `src/features/myDay/VipRegistrationsSheet.tsx` — replace `outcomeBreakdown` memo + the single line that renders it with the new two-line layered summary.

No other file changes. No DB schema changes. No migration. No new outcome values. No changes to `vip_registrations` semantics.

## What does NOT change

- Outcome dropdown options, labels, save logic, optimistic update behavior — unchanged
- `vipRules.isVipBooking` and VIP isolation — unchanged
- `VipClassPerformanceTable` math (which already correctly separates Registered / Attended / Intros Booked / Joins) — unchanged
- Coach attribution, sale credit routing, friend logic, questionnaire flow — unchanged
- Realtime subscriptions, role permissions, Central Time conventions — unchanged
- The `15 registered for this VIP class` subtitle and the big numeric headline — unchanged

## Downstream effects implemented

- Sheet math is now self-consistent: no-show + showed = registered, and "booked intro" is correctly framed as a subset of showed
- SAs reading the sheet immediately understand attendance vs conversion without mental math
- No other surface displays this breakdown, so nothing else needs to change
- No effect on stored data — any existing logged outcomes render correctly under the new framing

