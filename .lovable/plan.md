
# Data Attribution & Membership Tracking Improvements

## Problems Identified

### 1. Corrupted intro_owner Data (Critical Bug)
Found 8 booking records where `intro_owner` contains timestamps instead of staff names (e.g., "2026-02-04T03:49:24.615841+00:00" instead of "Katie"). This happened during data import/sync - the `created_at` value was accidentally written to `intro_owner`.

**Affected members:** Mary Waller, Carsyn Gleichowski, Brinley Frieberger, Alivia Ponzio, Kennedy Brezenski, Sophia Wilbeck, Calli Minor, Amaya Grant

### 2. Missing Auto-Attribution on Manual Entry
When SAs create intro runs via the Admin IntroRunsEditor with manual entry, the `intro_owner` should automatically be set to the person who ran the intro (from `ran_by` or `sa_name`), but this isn't happening for several records.

### 3. No Consolidated "Members Who Bought" View
The user wants a section showing all membership purchases in one place for easy reference.

### 4. No Bulk Inconsistency Finder/Fixer
The user wants a button that scans for attribution problems and fixes them automatically.

---

## Solution Overview

### Part A: Fix Corrupted Data (Database Update)
Run a one-time update to fix the 8 corrupted booking records where `intro_owner` contains timestamps.

### Part B: Add "Auto-Fix Attribution" Button
Add a new tool to the DataHealthPanel that:
1. Finds bookings with corrupted `intro_owner` (timestamp values)
2. Finds runs that have been completed but the linked booking has no proper `intro_owner`
3. Automatically sets `intro_owner` based on who ran the intro (`ran_by` or `sa_name`)

### Part C: Add "Members Who Bought" Section
Create a new admin panel component showing:
- All membership purchases (Premier/Elite/Basic from intros_run)
- Who bought, when, membership type, commission
- Who ran the intro and who booked it
- Filterable by date range

---

## Technical Implementation

### Files to Create
| File | Purpose |
|------|---------|
| `src/components/admin/MembershipPurchasesPanel.tsx` | New panel showing all people who bought memberships |

### Files to Modify
| File | Changes |
|------|---------|
| `src/components/admin/DataHealthPanel.tsx` | Add "Auto-Fix Attribution" button and corrupted `intro_owner` detection |
| `src/components/admin/IntroRunsEditor.tsx` | Ensure `ran_by` is properly set when creating/editing runs |
| `src/pages/Admin.tsx` | Add the new MembershipPurchasesPanel component |

### Database Update Required
Fix the 8 corrupted records:
```sql
-- Clear corrupted intro_owner values (timestamps instead of names)
UPDATE intros_booked 
SET intro_owner = NULL, intro_owner_locked = false
WHERE intro_owner LIKE '202%-%' OR intro_owner LIKE '%T%:%';

-- Then run auto-attribution to set correct intro_owner from linked runs
```

### Auto-Fix Attribution Logic
```
For each booking with NULL or corrupted intro_owner:
  1. Find linked runs (via linked_intro_booked_id)
  2. Find the first non-no-show run
  3. Get the ran_by or sa_name from that run
  4. Set intro_owner to that SA and lock it
```

For each run that has no `intro_owner` but has `ran_by` or `sa_name`:
  1. Set `intro_owner` = `ran_by` || `sa_name`
  2. If linked to a booking, update the booking's `intro_owner` too

### MembershipPurchasesPanel Features
- Table with columns: Member Name, Purchase Date, Membership Type, Commission, Intro Owner (who ran), Booked By
- Filter by date range (current pay period by default)
- Sort by date descending
- Highlight high-value sales (Premier + OTBeat)
- Shows totals at bottom

---

## Expected Outcomes

1. **Immediate Fix**: The 8 corrupted records will be cleaned up
2. **Auto-Fix Button**: One-click solution to find and fix attribution inconsistencies going forward
3. **Membership View**: Easy access to all purchases for reporting and verification
4. **Consistency**: Dashboard, Admin, and Payroll will all show matching numbers
