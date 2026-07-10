## Problem

1. **Keyerra shows up in Ellie's "referral leads" drilldown** even though her current `lead_source = 'Event / Self Generated Lead'` with no `referred_by_member_name` — she is an SGL, not a referral. Root cause: a `soml_pending_referrals` row was created earlier (when the source/referrer state was different) and never cleaned up when the booking was edited. The `soml_create_pending_referral` trigger only fires on INSERT and only ever adds rows — it never removes stale ones.

2. Same class of bug will hit any booking whose `lead_source` or `referred_by_member_name` is edited after creation (referral ↔ non-referral flips leave stale/missing pending rows).

3. Copy: "Self-Sourced Leads" needs to read "Self Generated Leads" everywhere it's user-facing.

## Fix

### 1. DB migration — keep `soml_pending_referrals` in sync with the booking

- Extract the qualification logic into a SQL helper `public.soml_booking_qualifies_as_referral(intros_booked)` returning boolean, matching the current INSERT rules:
  - `lead_source` in the explicit referral list OR ends with `(Friend)` AND `referred_by_member_name` is non-blank, OR
  - `paired_booking_id IS NOT NULL` AND `referred_by_member_name` is non-blank.
- Replace/augment the trigger:
  - **AFTER INSERT** — existing behavior (unchanged).
  - **AFTER UPDATE OF lead_source, referred_by_member_name, paired_booking_id, deleted_at**:
    - If row no longer qualifies (or is soft-deleted) → **delete** the matching `soml_pending_referrals` row (only when `state = 'pending'`, so we never nuke an already-realized referral that's been counted toward someone's SOML).
    - If row now qualifies and no pending row exists for the chain → call the existing create path.
- One-time cleanup in the same migration:
  ```sql
  DELETE FROM soml_pending_referrals p
  WHERE p.state = 'pending'
    AND NOT public.soml_booking_qualifies_as_referral(
      (SELECT b FROM intros_booked b WHERE b.id = p.booking_id)
    );
  ```
  This removes Keyerra's stale row and any siblings.

### 2. Frontend — rename "Self-Sourced" → "Self Generated" (user-facing copy only)

Change display strings; keep function/file/variable names as-is to avoid churn.

- `src/components/wig/SourcedLeadsDialog.tsx` — DialogTitle "Self-Sourced Leads" → "Self Generated Leads"; footer "self-sourced record(s)" → "self-generated record(s)".
- `src/components/wig/WigSaLeaderboard.tsx` — drill title "Self-sourced leads" → "Self Generated Leads"; remove-confirm copy "self-sourced count" → "self-generated count"; helper text "self-sourced lead" → "self-generated lead".
- `src/components/table/SaWeeklyGoals.tsx` — label "Leads (self-sourced)" → "Leads (self-generated)".
- `src/features/myDay/SelfSourcedLeadEntry.tsx` — card title "Log a lead you sourced" stays; no user-visible "self-sourced" string — leave.
- `src/features/myDay/SourcedLeadsToText.tsx` — only comments; skip.
- Comment/JSDoc-only occurrences (hooks, `lib/sa/*`) — leave untouched.

### 3. Verification (coherence proof)

- `SELECT * FROM soml_pending_referrals WHERE booking_id = 'b3f46280…'` returns 0 rows.
- Ellie's SOML "referral leads" drilldown drops from 3 → 2 (Adriana manual + Lauren pending remain).
- Toggle Keyerra's `lead_source` to a real referral (`Member Referral`, set `referred_by_member_name`) via the edit UI → pending row reappears; toggle back → pending row disappears. Verified with `read_query` after each toggle.
- Grep confirms no user-facing "Self-Sourced" strings remain.

### Files touched
- new migration: trigger + helper + cleanup DELETE
- `src/components/wig/SourcedLeadsDialog.tsx`
- `src/components/wig/WigSaLeaderboard.tsx`
- `src/components/table/SaWeeklyGoals.tsx`
