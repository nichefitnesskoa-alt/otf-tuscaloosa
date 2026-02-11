

# VIP Class Grouping by Event Name

## What This Does

Adds a "VIP Class Name" field so you can organize VIP clients into named groups (e.g., "Miss Alabama VIP Class", "Chamber of Commerce VIP Class"). In the VIP tab, clients are grouped under collapsible headers by their class name, so you can quickly see who belongs to which event.

## What Changes

### 1. Database: Add `vip_class_name` column

Add a `vip_class_name` text column to both `vip_registrations` and `intros_booked` tables. Using `intros_booked` ensures the grouping works even for clients without a `vip_registrations` row. Existing VIP bookings default to `null` -- you can backfill the 17 Miss Alabama imports afterward.

### 2. Public VIP Registration Form (`VipRegister.tsx`)

Currently the form is generic. Two options for how to assign the class name:

- **URL parameter approach** (recommended): You create a link like `/vip-register?class=Miss+Alabama` and share that specific link with the group. The form reads the class name from the URL and stores it automatically -- clients never see or type it.
- The class name displays on the form as a subtitle so clients know which event they're registering for.

### 3. Bulk Import (`VipBulkImport.tsx`)

Add a "VIP Class Name" input field above the paste area. Whatever you type there (e.g., "Miss Alabama") gets applied to all rows in that import batch. This way you paste your spreadsheet and all 17 people get tagged as "Miss Alabama."

### 4. VIP Tab Grouping (`ClientJourneyReadOnly.tsx` + `ClientJourneyPanel.tsx`)

When viewing the VIP tab, clients are grouped under headers by their class name:

```text
--- Miss Alabama (17) ---
  [client cards...]

--- Chamber of Commerce (8) ---
  [client cards...]

--- Ungrouped (3) ---
  [client cards...]
```

Each group is collapsible. The class name and count show as a purple-tinted section header.

### 5. Backfill Existing Imports

After the schema change, run a quick update to tag the 17 existing VIP bookings as "Miss Alabama" (or whatever you'd like to name that class). This can be done via Admin or a one-time data update.

---

## Technical Details

### Database Migration

```sql
ALTER TABLE vip_registrations ADD COLUMN vip_class_name text;
ALTER TABLE intros_booked ADD COLUMN vip_class_name text;
```

Using `intros_booked` as the source of truth for grouping since every VIP client has a booking, but not all have a `vip_registrations` row (bulk imports without birthday/weight).

### VipRegister.tsx

- Read `class` query parameter from URL using `useSearchParams()`
- Store in `intros_booked.vip_class_name` and `vip_registrations.vip_class_name`
- Display the class name on the form as a subtitle badge
- If no class parameter, show a generic "VIP Class" label

### VipBulkImport.tsx

- Add an `Input` field for "VIP Class Name" at the top
- Pass the value into each `intros_booked` insert as `vip_class_name`
- Also store in `vip_registrations.vip_class_name`

### ClientJourneyReadOnly.tsx + ClientJourneyPanel.tsx (VIP tab only)

- Fetch `vip_class_name` from `intros_booked` alongside existing booking data
- When `activeTab === 'vip_class'`, group filtered journeys by `vip_class_name`
- Render each group under a collapsible section header with count
- Clients with no class name go under "Ungrouped"

### File Summary

| Action | File | What Changes |
|--------|------|-------------|
| Create | DB migration | Add `vip_class_name` to `intros_booked` and `vip_registrations` |
| Edit | `src/pages/VipRegister.tsx` | Read class name from URL param, store on both tables |
| Edit | `src/components/admin/VipBulkImport.tsx` | Add class name input, apply to all imported rows |
| Edit | `src/components/dashboard/ClientJourneyReadOnly.tsx` | Group VIP tab by class name with collapsible headers |
| Edit | `src/components/admin/ClientJourneyPanel.tsx` | Same grouping for admin view |

