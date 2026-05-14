# Fix: Madison can't lock in her Own It answers

## Root cause

`table_owner_entries` has `UNIQUE(meeting_id, owner_id)`. The current `OwnerEntryForm` (`src/pages/TheTable.tsx` ~lines 689–749) does this on every field blur:

- If `entry` prop is undefined → `INSERT` a new row.
- Else → `UPDATE` that row.

`entry` only refreshes after React Query refetches following the previous save. When a user tabs/blurs through fields quickly (Madison's flow), 2–4 blurs fire `INSERT` before the first refetch lands. The 2nd/3rd/4th INSERTs hit the UNIQUE constraint and fail silently. Those fields' text is lost, and in the worst case all four race so no row exists at all — then "Fill at least one field first." fires when she clicks Lock In.

The error toast is misleading; she did fill them in. The data just never persisted.

## Fix

Two changes in `src/pages/TheTable.tsx`, scoped to `OwnerEntryForm`:

1. **Guarantee a single entry row up front.** On mount (when `entry` is undefined), upsert a blank row keyed on `(meeting_id, owner_id)` and use the returned id for all subsequent saves. This eliminates the race entirely — every blur becomes an `UPDATE` against a known id.

2. **Switch field saves to always `UPDATE` by id**, never branch on `entry` existence. Use `upsert(..., { onConflict: 'meeting_id,owner_id' })` as a defensive fallback so a blur that beats the initial ensure-row call still merges instead of erroring.

3. **Remove the "Fill at least one field first." gate.** Per the user's instruction ("Make it not required if anything"), Lock In should always work. The submit button just stamps `submitted_at`. If every field is blank that's fine — she can lock in nothing and edit later (the form already supports unlock/edit via the parent).

4. **Surface real errors.** The current `save()` throws away Supabase errors. Add an error toast so future silent-failure regressions are visible instead of presenting as "data didn't save and Lock In is broken."

No schema change. No behavior change for users who fill fields slowly. Madison's fast-tabbing flow now persists every field and locks in cleanly.

## Files touched

- `src/pages/TheTable.tsx` — `OwnerEntryForm` only.

## Verification

- Open Own It as a non-architect owner with no existing entry → confirm exactly one row appears in `table_owner_entries` after first render (via realtime/refetch).
- Fill all four fields rapidly, blurring each → confirm all four values land on the same row.
- Click Lock In with empty fields → confirm `submitted_at` stamps and no error toast.
- Click Lock In with filled fields → confirm normal flow still works, card locks, mentions still trigger notifications via existing trigger.
- Confirm no other consumer of `table_owner_entries` (read paths in `useOwnerEntries`, lane health, exports) changes behavior — they only read rows, which are now guaranteed to exist one-per-owner-per-meeting.
