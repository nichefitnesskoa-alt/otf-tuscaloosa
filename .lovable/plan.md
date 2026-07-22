# Team sticky notes

Let a note be assigned to the whole team instead of one person. Each teammate acknowledges it individually; anyone can mark the whole note done.

## Schema

New table `public.sticky_note_acks`:
- `id uuid pk default gen_random_uuid()`
- `note_id uuid not null references sticky_notes(id) on delete cascade`
- `user_name text not null`
- `acknowledged_at timestamptz not null default now()`
- `unique (note_id, user_name)`
- RLS on, `GRANT SELECT, INSERT, DELETE` to `authenticated` (+ `service_role` all), plus permissive policies matching the existing `sticky_notes` pattern (name-based, not auth-uid).

`assigned_to` on `sticky_notes` uses the literal sentinel string `"Team"` for team notes — no schema change needed. Existing self-ack trigger on `sticky_notes` still fires for individual notes; team notes ignore its `acknowledged_at` column entirely (state is derived from the acks table).

## Logic (canonical helper)

Extend `src/hooks/useStickyNotes.ts`:
- Fetch `sticky_note_acks` alongside notes, subscribe to Realtime.
- Export `TEAM_ASSIGNEE = 'Team'` and `isTeamNote(n)`.
- Rewrite `stickyState(note, viewerName, acks)` so for team notes: `done` if `completed_at`; else `acked` if an ack row exists for `(note.id, viewerName)`; else `new`. Individual notes keep current behavior.
- `useMyOpenStickyCount(name)` counts individual notes assigned to `name` **plus** team notes with no ack row for `name` and no `completed_at`. Drives the existing bottom-nav badge unchanged.

## UI (`src/pages/StickyNotes.tsx`)

- `NewNoteDialog`: prepend a "🟠 Team (everyone)" option above the staff list in the Assign dropdown; selecting it writes `assigned_to: 'Team'`.
- `NoteCard`:
  - Header "For:" shows **Team** with a small `n/total acked` chip when it's a team note (total = `allActive.length`).
  - `canAck` = viewer hasn't acked yet AND (is the assignee OR it's a team note). Ack writes to `sticky_note_acks` for team notes; unchanged for individual notes.
  - `canDone` = any assignee-or-team-member for team notes; unchanged for individual.
  - Status chips ("Needs your ack" / "Acknowledged") read the per-viewer state.
- Filters:
  - `assigned` ("For me") includes team notes not yet acked/done by viewer.
  - `mine` unchanged (creator-scoped).
  - `all` unchanged (hides done).

## Files touched

- `supabase/migration` — new `sticky_note_acks` table + grants + RLS + policies.
- `src/hooks/useStickyNotes.ts` — acks fetch/subscribe, updated `stickyState`, `useMyOpenStickyCount`, `TEAM_ASSIGNEE` export.
- `src/pages/StickyNotes.tsx` — Team option in dialog, per-viewer ack UI, ack-count chip, filter update.

No changes to team chat, individual-note behavior, or existing self-ack trigger.

## Coherence proof (to produce after build)

Real DB rows verified:
- Create a team note as one user → `sticky_notes` row with `assigned_to='Team'`, zero `sticky_note_acks` rows.
- Ack as user A → one ack row (A). Badge count for A drops by 1, B unchanged.
- Ack as user B → second ack row. Chip reads `2/N acked`.
- Any user marks done → `completed_at` set, note leaves all "For me" lists, badge for every user drops.
- Bottom-nav badge on `/sticky-notes` for a given user equals: individual notes assigned to them + open + un-acked + team notes with no ack row for them + not done. Numbers agree across page filter chip and nav badge. All agree: yes.
