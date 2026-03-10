

## Plan: Click-to-Drill People Lists in Lead Source Analytics and Conversion Funnel

### Approach

Make the Booked/Showed/Sold metric boxes in both **LeadSourceChart** and **ConversionFunnel** clickable. When tapped, a Sheet (bottom drawer) opens showing the actual people in that category for the selected time period and source/funnel row.

### Changes

#### 1. Create `FunnelDrillSheet` component (`src/components/dashboard/FunnelDrillSheet.tsx`)

A reusable Sheet that receives a title (e.g. "Instagram DMs — Booked"), a list of people `{ name, date, leadSource?, result?, coach? }[]`, and open/close state. Renders a simple scrollable list with name, date, and relevant status info. Each person entry shows:
- **Booked**: member name, class date, coach, lead source
- **Showed**: member name, class date, result
- **Sold**: member name, membership type, buy date

#### 2. Update `LeadSourceChart` to accept people data and drill

- Expand the `LeadSourceData` interface to include `bookedPeople`, `showedPeople`, `soldPeople` arrays (each with `{ name, date, detail? }`).
- Make the Booked/Showed/Sold boxes in `SourceRow` clickable (cursor-pointer, subtle hover). On click, open the `FunnelDrillSheet` with that list.
- The parent (`Recaps.tsx`) already computes per-source data from raw bookings/runs — extend the computation in `useDashboardMetrics` (and the Recaps filtered version) to also collect the people arrays alongside the counts.

#### 3. Update `useDashboardMetrics` to collect people lists

In the `leadSourceMetrics` builder (~line 370-450), alongside incrementing `booked++`, also push `{ name: b.member_name, date: b.class_date }` to a `bookedPeople` array. Same for `showedPeople` and `soldPeople`. This keeps the single-source-of-truth principle intact — counts and people come from the same loop.

The `LeadSourceMetrics` interface gains:
```typescript
bookedPeople: { name: string; date: string; detail?: string }[];
showedPeople: { name: string; date: string; detail?: string }[];
soldPeople: { name: string; date: string; detail?: string }[];
```

#### 4. Update `ConversionFunnel` to support drill-down

- `ConversionFunnel` already has direct access to `introsBooked` and `introsRun` via `useData()`.
- Extend `computeFunnelBothRows` to also return people arrays for each row (1st, 2nd, total, journey).
- Make the Booked/Showed/Sold boxes in `FunnelRow` clickable, opening the same `FunnelDrillSheet`.

#### 5. Update `Recaps.tsx` filtered lead source

The filtered per-employee lead source computation in `Recaps.tsx` (~line 110-133) also needs to collect people arrays when building `sourceMap`.

### Files to modify
- `src/components/dashboard/FunnelDrillSheet.tsx` — **new** reusable Sheet
- `src/hooks/useDashboardMetrics.ts` — add people arrays to `LeadSourceMetrics`
- `src/components/dashboard/LeadSourceChart.tsx` — make boxes clickable, open drill sheet
- `src/components/dashboard/ConversionFunnel.tsx` — make boxes clickable, open drill sheet
- `src/pages/Recaps.tsx` — update filtered lead source to include people arrays

