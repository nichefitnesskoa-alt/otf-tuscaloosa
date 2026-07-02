## Problem

Kaiya's lead entered via WIG's "+ Add Lead" button doesn't show up on the SA leaderboard. Two bugs, one root cause: the WIG dialog and the MyDay entry are not the same code path.

- `WigSaLeaderboard` opens `AddLeadDialog` (`src/components/leads/AddLeadDialog.tsx`).
- MyDay opens `SelfSourcedLeadEntry` (`src/features/myDay/SelfSourcedLeadEntry.tsx`).

Only MyDay's writes `sourced_by_sa: user.name`. WIG's does not, so:
1. The lead is created but has no SA attribution → it never appears in the SA's "Leads" column on the WIG leaderboard (that column filters by `sourced_by_sa`).
2. WIG's dialog requires email, but the schema doesn't — it's just an over-strict client check that pushed Kaiya into a state where the SA identity was still never captured even if she satisfied it.
3. WIG's dialog allows inbound sources (Lead Management, Online Intro Offer) that would corrupt the leaderboard if used.
4. No `notifyDataChanged(['leads','sa-leads'])`, so even a valid write wouldn't refresh the WIG tiles/columns without a hard reload.

## Fix

Make the WIG "+ Add Lead" button use the exact same self-sourced write path as MyDay. One canonical component, one behavior everywhere.

### 1. Replace `AddLeadDialog` usage in WIG with the self-sourced flow
In `src/components/wig/WigSaLeaderboard.tsx`:
- Remove `import { AddLeadDialog }` and its render.
- Add a new `SelfSourcedLeadDialog` (thin dialog wrapper around the same form logic MyDay uses) and open it from the "+ Add Lead" button.

### 2. Extract the self-sourced form into a shared component
Create `src/components/leads/SelfSourcedLeadForm.tsx` containing the form + submit logic currently inside `SelfSourcedLeadEntry.tsx`. Behavior (identical to MyDay today):
- Required: first name, last name, phone. Email optional.
- Source dropdown restricted to `SELF_SOURCED_OPTIONS` (no Lead Management / Online Intro Offer).
- Writes `sourced_by_sa: user.name`.
- Inserts activity log row.
- Calls `notifyDataChanged(['leads','sa-leads'])`.
- Offers "Save lead" and "Save and book intro" (opens `BookIntroDialog`).

Refactor `SelfSourcedLeadEntry.tsx` to render this shared form inside its collapsible card so MyDay behavior is unchanged.

Create `src/components/leads/SelfSourcedLeadDialog.tsx` — a Dialog that renders the same shared form, used by WIG. Title: "Log a lead you sourced". Same warning banner about not logging inbound leads.

### 3. Delete the old divergent dialog
Remove `src/components/leads/AddLeadDialog.tsx` (only WIG referenced it). Any other reference found during implementation gets pointed at the new dialog.

### 4. Refresh after add
On successful save the dialog calls `sourcedLeads.refetch()` (already wired via the current `onLeadAdded` prop) AND `notifyDataChanged` fires so every WIG consumer of `leads` / `sa-leads` recomputes.

## Coherence check (to run after build)

- Insert a test lead via the new WIG dialog signed in as an SA.
- `SELECT id, sourced_by_sa FROM leads ORDER BY created_at DESC LIMIT 1;` → confirm `sourced_by_sa` matches signed-in SA.
- WIG SA leaderboard "Leads" column for that SA → increments by 1 without reload.
- MyDay "Log a lead you sourced" card → still works, same DB shape.
- Verify Kaiya's orphaned lead(s): find rows with matching name/phone from today where `sourced_by_sa IS NULL` and back-fill with `sourced_by_sa = 'Kaiya'` so she gets credit.

## Files touched

- `src/components/leads/SelfSourcedLeadForm.tsx` (new)
- `src/components/leads/SelfSourcedLeadDialog.tsx` (new)
- `src/features/myDay/SelfSourcedLeadEntry.tsx` (refactor to use shared form)
- `src/components/wig/WigSaLeaderboard.tsx` (swap dialog)
- `src/components/leads/AddLeadDialog.tsx` (delete)
- Data fix: back-fill Kaiya's orphaned lead(s) via `supabase--insert` UPDATE.
