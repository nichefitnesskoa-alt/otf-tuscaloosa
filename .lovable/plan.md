

# Add Speed-to-Lead Metric on My Day Leads Tab

## What It Does

Adds a visible, at-a-glance speed-to-lead summary banner at the top of the New Leads tab. This gives the SA an immediate sense of urgency and performance without scrolling through individual cards.

## What the Metric Shows

A compact stats bar above the lead cards with:

- **Avg Response Time** -- Average minutes/hours from lead creation to when it was marked "Contacted" (only for leads that have been contacted)
- **Fastest Response** -- Best (shortest) response time in the current set
- **Overdue Count** -- Number of "New" leads that are 4+ hours old and haven't been contacted yet (red badge)
- **Needs Contact** -- Number of "New" leads 1-4 hours old (amber badge)

Color-coded status: Green (all leads contacted within 1h), Amber (some 1-4h), Red (any 4h+ overdue).

## Technical Changes

### File: `src/features/myDay/MyDayNewLeadsTab.tsx`

1. Add a new `SpeedToLeadBanner` component inside the file that:
   - Receives the `leads` array
   - Filters "new" leads to count overdue (4h+) and warning (1-4h) buckets
   - Filters "contacted" leads and calculates average response time using `created_at` vs `updated_at` (the timestamp when stage changed to "contacted")
   - Displays a compact horizontal stats bar with the 4 metrics above
   - Uses color-coded badges matching the existing card border colors (red/amber/green)

2. Render `SpeedToLeadBanner` at the top of the component, just above the sub-tabs (New | Flagged | Contacted etc.)

### No other files changed

The banner uses only data already fetched (`leads` state array) -- no new queries or database changes needed. The `updated_at` field on the `leads` table is already set when a lead's stage changes, so it serves as the "contacted at" timestamp for response time calculation.

## Visual Layout

```text
+--------------------------------------------------+
| Speed to Lead                                     |
| Avg: 45m | Best: 12m | 🔴 2 Overdue | ⚠ 3 Soon  |
+--------------------------------------------------+
| [New] [Flagged] [Contacted] [Booked] [In System]  |
| ... lead cards ...                                 |
```

