## What's broken

Own It (`/the-table`) has two places people type:

1. **OwnerEntryForm** — the 4 lane-update fields (Last week / This week / Ideas / Ask). These use `MentionInput` in **uncontrolled** mode (`defaultValue` + `onBlur`).
2. **OwnerLiveCard** — the Add / Flag / Own It response box. Uses `MentionInput` in **controlled** mode.

Three issues stack up to make typing feel broken:

### Issue 1 — `MentionInput` is half-controlled
In `src/components/shared/MentionInput.tsx`:
```tsx
defaultValue={isControlled ? undefined : defaultValue}
value={isControlled ? text : undefined}
```
Passing `value={undefined}` plus `defaultValue` on the same `<Textarea>`/`<Input>` puts React in a fragile mode. Every parent re-render (and Own It re-renders constantly from realtime invalidations on `table_owner_entries`, `table_responses`, `table_owners`) re-evaluates `defaultValue` from the latest `entry?.field`. If React ever flips its internal "controlled?" decision because of an `undefined`→string transition, the input snaps back to the old DB value and the user's in-progress text disappears.

### Issue 2 — OwnerEntryForm mounts before its row exists
`OwnerEntryForm` runs an `upsert` in `useEffect` to create the empty entry. That upsert fires realtime → invalidates `table-entries` → refetches → parent passes a new `entry` object → `val` recomputes → `defaultValue` prop changes from `''` to `''`. Combined with Issue 1 this is enough to wipe characters mid-typing on slower devices. It also means if the user types fast enough to blur before `entryId` is set, the first `save()` upsert races the mount upsert and one of them wins with stale text.

### Issue 3 — Inline `onChange`/`refresh` callbacks
`TheTable` builds `onChange={() => refresh('table-entries')}` inline every render. `refresh` itself is rebuilt every render. So `OwnerEntryForm`'s mount effect has a churning `onChange` in its deps; combined with realtime invalidations, the form re-runs work unnecessarily and any internal `useMemo` keyed on these props thrashes.

## The fix (three small surgical changes)

### 1. `src/components/shared/MentionInput.tsx` — make it always controlled internally
- Always render `<Field value={text} onChange={handleChange} />`. Never pass `defaultValue` to the underlying field.
- Keep `internal` state seeded from `defaultValue ?? ''`.
- Sync `internal` from `defaultValue` **only when an explicit `resetKey` prop changes** (new optional prop). That way re-renders triggered by realtime cannot blow away typed text.
- Keep `value`/`onChange` controlled mode working unchanged for callers that pass them.

This single change makes every consumer (OwnerEntryForm, OwnerLiveCard, Win logger) bulletproof against re-render-driven text loss.

### 2. `src/pages/TheTable.tsx` — `OwnerEntryForm` hardening
- Move the "ensure entry row exists" upsert into a small hook scoped to `(meetingId, ownerId)` that only runs once per pair and stores the resolved `entryId` in a ref. Stop depending on `onChange` in its deps.
- Pass `resetKey={entry?.id ?? 'new'}` to each `MentionInput` so that when the row is first created the inputs accept the fresh empty defaults exactly once, and after that ignore prop churn.
- Wrap `refresh` and the per-form `onChange` in `useCallback` with stable deps so child effects don't see new function identities every render.

### 3. `src/hooks/useActiveStaff.ts` — stabilise derived arrays
- Memoise `allActive`, `coaches`, `salesAssociates` on `staff`. Currently they're rebuilt every call, which makes every `MentionInput` instance see "new" arrays and recompute candidates each render. Not the proximal cause of input failure but it's noise in the same hot path.

## How we verify it sticks

1. Open `/the-table`, claim a lane, type into all 4 fields rapidly — every character stays.
2. Have a second tab post a response (or flip the meeting) while typing in the first tab — typed text survives realtime invalidations.
3. Open the Add / Flag / Own It composer in the live view, type with `@` triggering the mention popup, press Enter to insert — caret + remaining text intact.
4. Log a win from the dialog — text persists through the `table-wins` insert.
5. Confirm no console warnings about "changing controlled to uncontrolled component".

## Files touched

- `src/components/shared/MentionInput.tsx` (controlled-only refactor + `resetKey` prop)
- `src/pages/TheTable.tsx` (`OwnerEntryForm` seeding + stable callbacks + `resetKey` passthrough)
- `src/hooks/useActiveStaff.ts` (memoised derived lists)

No database changes. No behaviour changes for other consumers of `MentionInput` — they continue to work in their existing controlled mode.