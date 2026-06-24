## Goal

Add an in-app "Imported to Mindbody" report so Koa can pull who-was-checked-off-by-whom without asking each time. Covers both `leads.mindbody_imported_at` (sourced leads checked off in the WIG drilldown / SourcedLeadsDialog) and `vip_registrations.mindbody_imported_at` (VIP roster check-offs) — so it stays coherent with both surfaces that already write the flag.

## Where it lives

New tab **"Mindbody Imports"** on the existing Admin page (`src/pages/Admin.tsx`), Admin-only (matches existing `is Koa` gate). One screen, no nav reshuffle.

## What it shows

Top controls (sticky):
- Date-range presets: **Yesterday** (default), **Today**, **This week (Mon–today, CST)**, **Last 7 days**, **Custom**.
- Custom = two shadcn date pickers (with `pointer-events-auto`).
- "Imported by" filter chip row built from `useActiveStaff().salesAssociates` plus any historical name present in the range (so it never silently drops "Kaiya" if she's been deactivated).
- Total count pill on the right.
- **Copy list** and **Download CSV** buttons.

Body:
- Grouped by SA, descending by count. Each group is a card:
  - Header: `Kaiya — 19 imported`
  - Rows: `Name · (phone) · 12:46 PM · [Lead | VIP: <group>]`
  - Tap row → opens the existing person journey drawer (`PersonJourneyCard`) if a `leads` row exists.
- Empty state: "No one was checked off as imported in this range."

## Data source (single query, two tables, one canonical helper)

New helper `src/lib/admin/mindbodyImports.ts`:

```ts
fetchMindbodyImports(rangeStartUtc, rangeEndUtc) → Array<{
  kind: 'lead' | 'vip',
  id, name, phone, importedBy, importedAt, sourceLabel
}>
```

- Selects from `leads` where `mindbody_imported_at >= start AND < end`, and from `vip_registrations` same, in parallel.
- Date range is built in America/Chicago (`startOfDayCT` / `endOfDayCT` from `src/lib/dateUtils.ts`), then converted to UTC ISO for the query. No `new Date('YYYY-MM-DD')`.
- Returns one merged, sorted array.

This becomes the single source of truth — if SourcedLeadsDialog or VipRoster ever changes how the flag is written, this helper still reads the same DB columns.

## React Query + realtime

- Query key: `['mindbody-imports', startISO, endISO]`.
- Realtime subscriptions on `leads` and `vip_registrations` (filtered on the `mindbody_imported_at` column changing) invalidate the key so a fresh check-off appears live.
- Same `useEffect`-scoped channel pattern used elsewhere (cleanup on unmount).

## CSV export

`Date (CT), Time (CT), Name, Phone, Imported By, Source` — written with the existing CSV pattern (`src/lib/sa/sourcedLeadsCsv.ts` shape, not a new lib). Filename `mindbody-imports-YYYY-MM-DD_to_YYYY-MM-DD.csv`.

## Files touched

- `src/pages/Admin.tsx` — add tab trigger + content slot
- `src/components/admin/MindbodyImportsPanel.tsx` (new) — the UI
- `src/lib/admin/mindbodyImports.ts` (new) — fetch helper + types

## Cross-page coherence

For the chosen date range, the panel's per-SA counts must equal:
- A direct DB count of `leads` + `vip_registrations` filtered by `mindbody_imported_at` in CST window, grouped by `mindbody_imported_by`.
- The same set SourcedLeadsDialog uses to render its green "Imported" pills for that date.

Will verify both before reporting done.

## Out of scope

- No DB migration — columns already exist.
- No change to write paths (`useMarkLeadImported`, VipRoster check-off).
- No change to WIG tiles or other dashboards.
- No new role/permission — Admin only.

## Closing-line contract

Will close with COHERENCE PROOF: actual DB row counts per SA for yesterday + the panel's displayed numbers + confirmation they match.