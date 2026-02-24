

# Fix: Lead Measures crashing after staff filter

## Problem

The `ensure()` function now silently skips names not in `ALL_STAFF` (returns without adding to the map), but the calling code on lines 83, 95, 103, and 131 unconditionally does `saMap.get(sa)!` — which returns `undefined` and crashes the entire `load()` function. The catch block swallows the error, so the table just shows no data.

Additionally, the `booked_by` field in the database may contain values like "Self booked" or "Self-booked" (set by the `auto_set_booked_by_self_booked` trigger), which won't match `ALL_STAFF`. When `booked_by` is "Self booked" and `intro_owner` is a valid staff name, the current fallback `b.booked_by || b.intro_owner` picks "Self booked" first and discards the valid `intro_owner`.

## Fix — `src/hooks/useLeadMeasures.ts`

1. After every `ensure(sa)` call, add a guard: `if (!saMap.has(sa)) return;` (or `continue` in forEach). This prevents the `!` assertion from crashing on undefined.

2. Fix the attribution fallback on line 80 to skip non-staff values of `booked_by`: pick whichever of `booked_by` or `intro_owner` is actually in `ALL_STAFF`, falling back to the other.

Specifically, change line 80 from:
```ts
const sa = b.booked_by || b.intro_owner || '';
```
to:
```ts
const sa = [b.booked_by, b.intro_owner].find(n => n && ALL_STAFF.includes(n)) || '';
```

And after each `ensure(sa)` call, add a guard before accessing the map:
- Line 83: `const s = saMap.get(sa); if (!s) return;`
- Line 95: `const entry = saMap.get(sa); if (entry) entry.touches++;`
- Line 103: `const entry = saMap.get(sa); if (entry) entry.dms += r.dms_sent;`
- Line 131: `const s = saMap.get(contact.performer); if (!s) return;`

No other files need changes.

## Result

Staff names that exist in `ALL_STAFF` will appear with their metrics. "Self booked", "Self-booked", empty strings, and non-staff values are safely skipped without crashing. The table will show real staff who have activity in the selected date range.

