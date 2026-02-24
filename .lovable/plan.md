

# Why Sophie's Prep % Isn't Showing

## Root Cause — Two Bugs

### Bug 1: SA attribution picks `booked_by` first (line 81)

```ts
const sa = [b.booked_by, b.intro_owner].find(n => n && ALL_STAFF.includes(n)) || '';
```

This checks `booked_by` before `intro_owner`. If someone else booked Sophie's intros, the prep credit goes to the booker, not Sophie. For prep rate, the correct attribution should be `intro_owner` (or `prepped_by`) since they're the one who actually preps.

### Bug 2: Filter excludes SAs with only prep/intros data (line 165)

```ts
.filter(s => (s.qCompletionPct !== null || s.followUpTouches > 0 || s.dmsSent > 0 || s.leadsReachedOut > 0))
```

This filter doesn't check `prepRatePct` or `introsRan`. If Sophie has prep data and intros ran but zero follow-up touches, zero DMs, zero leads reached, and no Q completions attributed to her, she gets completely filtered out of the results.

### Bug 3: Sort order is by outreach metrics (line 166)

Now that outreach moved to its own tab, the Lead Measures table should sort by something more relevant like intros ran or prep rate.

## Fix — `src/hooks/useLeadMeasures.ts`

### Line 81: Use `intro_owner` first for prep attribution

Change from:
```ts
const sa = [b.booked_by, b.intro_owner].find(...)
```
To:
```ts
const sa = [b.intro_owner, b.booked_by].find(...)
```

This ensures the person who owns/runs the intro gets the prep and Q credit, which is what matters for lead measures.

### Line 165: Include `prepRatePct` and `introsRan` in the filter

Change to also keep SAs that have prep data or ran intros:
```ts
.filter(s => (s.qCompletionPct !== null || s.prepRatePct !== null || s.introsRan > 0 || s.followUpTouches > 0 || s.dmsSent > 0 || s.leadsReachedOut > 0))
```

### Line 166: Sort by intros ran (primary), then prep rate

Change sort to prioritize the metrics actually shown in the Lead Measures table:
```ts
.sort((a, b) => (b.introsRan - a.introsRan) || ((b.prepRatePct ?? 0) - (a.prepRatePct ?? 0)))
```

## Files Changed

| File | Change |
|------|--------|
| `src/hooks/useLeadMeasures.ts` | Fix SA attribution order, filter, and sort |

