

# Fix Leads Metrics Bar

## Changes

**File:** `src/components/leads/LeadMetricsBar.tsx`

Two fixes:

### 1. "Booked (Week)" should not count self-booked leads

Currently, `bookedThisWeek` counts any lead with a `booked_intro_id` updated this week. But leads auto-created by the import system (source like "Orangebook") get `booked_intro_id` set automatically -- these are self-booked online intros, not SA-driven conversions.

Fix: Only count leads where `booked_intro_id` is set AND the lead was originally in the leads pipeline (i.e., `source` is NOT an online/auto source like `"Orangebook Web Lead"` or `"Orangebook Online Intro"`). Alternatively, since leads created by Format B imports now skip the leads table entirely (per the recent edge function fix), the simplest approach is to exclude leads whose source starts with `"Orangebook"`.

### 2. Rename label from "Booked (Week)" to "Booked"

Drop the "(Week)" suffix. The other metrics like "Lost" also track the current week but don't say "(Week)". Keep it consistent and clean. Rename "Lost (Week)" to "Lost" as well for consistency.

### Updated code

```typescript
// Booked this week: exclude auto-imported / self-booked sources
const bookedThisWeek = leads.filter(l => {
  if (!l.booked_intro_id) return false;
  if (l.source?.startsWith('Orangebook')) return false;
  const updated = parseISO(l.updated_at);
  return isAfter(updated, weekStart) && isBefore(updated, weekEnd);
}).length;
```

Labels change:
- `'Booked (Week)'` becomes `'Booked'`
- `'Lost (Week)'` becomes `'Lost'`

### 30-day conversion rate

Also update the conversion rate calculation to exclude Orangebook-sourced leads, so it only measures SA pipeline effectiveness:

```typescript
const recent = leads.filter(l => 
  isAfter(parseISO(l.updated_at), thirtyDaysAgo) && 
  !l.source?.startsWith('Orangebook')
);
```

## File Summary

| Action | File |
|--------|------|
| Edit | `src/components/leads/LeadMetricsBar.tsx` -- exclude Orangebook sources from Booked count and conversion rate; rename labels |

