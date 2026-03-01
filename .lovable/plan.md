

## Plan: Add Tabs and Sortable Columns to Members Who Bought

### Changes to `src/components/admin/MembershipPurchasesPanel.tsx`

**1. Add internal tabs: All, Intro Sales, Outside Sales**
- Use Radix `Tabs` component with three tabs: "All", "Intro Sales", "Outside Sales"
- Filter the `purchases` array by `source` field based on active tab
- Stats summary recalculates based on the filtered view

**2. Make all columns sortable**
- Add `sortColumn` and `sortDirection` state (`asc`/`desc`)
- Clicking a column header toggles sort direction (or sets new column)
- Add `ArrowUpDown` / `ArrowUp` / `ArrowDown` icons from lucide to each `TableHead` to indicate sort state
- Sortable columns: Member, Date, Type, Commission, Ran By, Coach, Lead Source, Booked By
- String columns sort alphabetically, Date sorts chronologically, Commission sorts numerically
- `TableHead` elements become clickable buttons with cursor-pointer styling

**3. Implementation details**
- Tab state: `activeTab: 'all' | 'intro' | 'outside'`
- Filtered + sorted list computed in a single `useMemo` that first filters by tab, then sorts by the active column
- Stats summary uses the tab-filtered data so numbers reflect the current view

### Files Modified
- `src/components/admin/MembershipPurchasesPanel.tsx`

