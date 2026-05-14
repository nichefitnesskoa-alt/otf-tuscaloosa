## Goals

1. Add a search bar (name + phone) inside the MyDay → New Leads tab that filters both the Contacted and Booked sub-tabs.
2. Auto-detect leads who already have a real intro booked in the system (e.g. Katie Davis, Jacqueline Othmer) and move them from "Contacted" into "Booked" automatically — no manual cleanup needed.

## 1. Search bar in MyDay Leads tab

File: `src/features/myDay/MyDayNewLeadsTab.tsx`

- Add `search` state at the top of `MyDayNewLeadsTab`.
- Render a search input directly under the `TabsList` (so it sits right below the "Contacted / Booked" tab row and filters whichever tab is active). Includes a Search icon, an `X` clear button, placeholder "Search leads by name or phone…", and a small "{N} match" count when a query is entered.
- Filter is applied inside `renderList` callsites: case-insensitive name match (first + last) and digits-only phone match (so "2052706992", "(205) 270-6992", "205-270" all work).
- Searching never changes the active sub-tab; it just narrows the visible list within whichever tab the user is on.

## 2. Auto-move "already booked" leads from Contacted → Booked

Today, `runDeduplicationForLead` (called every 5 min by `backgroundDedupRecheck`) only updates `stage` when the lead is currently `new`, `flagged`, or `already_in_system`. Leads already marked `contacted` are skipped, so people like Katie Davis and Jacqueline Othmer stay stuck in Contacted even after a real booking exists.

Changes:

**A. `src/lib/leads/detectDuplicate.ts`**
- In `runDeduplicationForLead`, when the existing lead stage is `contacted` (or `new` / `flagged`) AND `detectDuplicate` returns a `HIGH`-confidence phone/email match against `intros_booked`, set:
  - `stage = 'booked'`
  - `booked_intro_id = matchedRecord.id` (the `intros_booked.id`)
  - Write a `lead_activities` row: `activity_type='stage_change'`, `notes='Auto-moved to Booked — matched existing intro <member_name> on <class_date>'`, `performed_by='System (auto-dedup)'`.
- If the matched booking is `CLOSED_PURCHASED` (already a member), keep current behavior — leave it for the existing "Clean Duplicates" tool to delete (we don't want auto-deletes from a background task).
- Name-only / `MEDIUM` matches keep current behavior (no stage change for `contacted`) to avoid false auto-moves.

**B. `src/features/myDay/MyDayNewLeadsTab.tsx`**
- `backgroundDedupRecheck` already iterates over `new` and `contacted` leads — no change needed beyond passing the current stage (already does). After it runs, the realtime UPDATE subscription will pull the new stage and the lead will jump to the Booked sub-tab automatically.

**C. One-time backfill (no migration, runs in the same code path)**
- The next background dedup pass after deploy will catch Katie Davis, Jacqueline Othmer, and any other contacted leads with matching `intros_booked` rows and move them to Booked. No manual action required.

## Verification

- Search: type "katie" on Contacted → only Katie shows; switch to Booked tab → search persists and filters Booked. Type "270" → matches by phone. Clear button empties the field.
- Auto-move: with Katie Davis currently in Contacted and a matching `intros_booked` row in the DB, reload My Day → within ~2 seconds (initial 1.5s dedup timer) Katie disappears from Contacted and appears in Booked with a "✓ Booked" banner. `lead_activities` row recorded for the stage change.
- Coherence: Leads page (`/leads`) reads from the same `leads` table, so the same auto-move applies there too. The existing "Clean Duplicates" button still handles purchased-member deletion (unchanged).

## Out of scope

- No DB migrations.
- No changes to the Pipeline new-leads tab (mirror change can be added later if you want it there too — say the word).
