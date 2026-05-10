I don't want military time anywhere. And I want that people in The Table sorted alphabetically. as well.  I want "The Table" Changed to "Own it"  
  
Fixes for The Table + Bottom Nav

### 1. "Duplicate key" when re-adding an owner

**Cause:** `ManageOwnersDialog.removeOwner()` soft-removes by setting `is_active = false`, but `availableStaff` only filters out owners that exist *at all* — so soft-removed staff drop off the "Add" dropdown, AND the add path always does `INSERT`, which collides with the unique constraint on `staff_id`.

**Fix:**

- `availableStaff` filter changes to exclude only **active** owners (`o.is_active && o.staff_id === s.id`), so Georgia reappears in the picker.
- `addOwner()` becomes upsert-style: if a `table_owners` row already exists for that `staff_id`, `UPDATE` it back to `is_active = true` (and clear lane/category if user wants a fresh start — see Q below). Otherwise `INSERT` as today.
- `useActiveOwners` already filters by `is_active = true`, so the list stays clean.

### 2. Auto-assign category from Ownership Role

- Remove the standalone Category dropdown from the per-owner editor.
- When the user picks/types an Ownership Role, look it up in `LANE_SUGGESTIONS` and auto-set `category` on save.
- If the role is custom (not in suggestions), category is left blank (or set to `Operations and Culture` as a default — see Q below).
- Category still stored in DB (used elsewhere); it's just no longer hand-picked.

### 3. Rename "Lane name" → "Ownership Role"

- Label in `ManageOwnersDialog`.
- Any user-facing copy in `TheTable.tsx` / `TheTableHistory.tsx` that says "Lane" gets updated to "Ownership Role" (DB columns stay `lane_name` / `category` — internal only).

### 4. Bottom nav spans full width on desktop

Current `BottomNav.tsx` uses `min-w-max` + `overflow-x-auto`, so 8 tabs hug the left on a 1267px viewport.

**Fix:**

- On `md+`: tabs distribute across full width (`flex-1` per button, no `min-w-max`, no horizontal scroll).
- On mobile: keep current scrollable behavior (8 tabs won't fit at 375px).
- Implementation: `md:min-w-0 md:w-full` on inner container, `flex-1 md:flex-1` on buttons, `md:overflow-visible` on `<nav>`.

### Files touched

- `src/components/table/ManageOwnersDialog.tsx` — upsert add, remove category select, rename label
- `src/components/BottomNav.tsx` — responsive width
- `src/pages/TheTable.tsx`, `src/pages/TheTableHistory.tsx` — copy: "Lane" → "Ownership Role"
- `src/hooks/useTheTable.ts` — only if mutation helper needs upsert support (likely not; dialog handles it)

### Confirm before I build

1. When re-adding a previously removed owner (e.g. Georgia), should I **preserve her old Ownership Role + category**, or **reset to blank** so it's a clean re-add?
2. For a custom Ownership Role the user types (not in the suggestion list), should category fall back to **blank**, **"Operations and Culture"**, or **prompt the user to pick one that one time only**?