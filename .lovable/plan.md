## Problems found

I pulled the actual data for the Bama Dining (May 22) session and traced the disconnect.

**1. "0 registered" is a silent query failure.**
`VipSchedulerTab.fetchSessions()` runs:
```ts
sb.from('vip_registrations')
  .select('vip_session_id, is_group_contact, estimated_group_size')
```
`estimated_group_size` lives on `vip_sessions`, NOT `vip_registrations`. The select errors out, `regs` comes back empty, every card renders `0 registered` — even when the Registrations dialog (which uses a correct select) shows 5 people. That's exactly what your screenshots show: card says 0, dialog says 5 Registered.

**2. Group contact lives in the wrong place.**
The group contact (Nicole Welch) is stored only as `reserved_contact_name/phone/email` on `vip_sessions`. She is never inserted into `vip_registrations`, so:
- She's not in the roster, CSV export, or attendance count.
- There's no way to add her details (fitness level, injuries, birthday, etc.) like a real attendee.
- There's no "add another person" affordance inside the Registrations dialog at all — staff currently have to send the public registration link to add anyone after the fact.

**3. Pipeline VIP tab vs VIPs page "don't communicate".**
Both pages render the exact same `VipSchedulerTab`, so the disconnect you're seeing is the same `0 registered` bug surfacing in both places plus the group contact not being counted. Fixing #1 and #2 makes the two views agree by construction (single source of truth — same query, same rows).

## Plan

### A. Fix the registered count (root cause)
- In `src/features/pipeline/components/VipSchedulerTab.tsx`, remove `estimated_group_size` from the `vip_registrations` select inside `fetchSessions`.
- Count registered = all rows for the session (group contact included, see B).
- Keep `regEstimates` sourced from `vip_sessions.estimated_group_size` (already on the session), not from registrations.

### B. Promote group contact to a real registration
- When a session is marked Reserved with a group contact, also upsert a `vip_registrations` row for that contact with `is_group_contact = true` and `vip_session_id = <session>`. Backfill once for existing reserved sessions that have `reserved_contact_name` but no matching registration row (one-time migration, idempotent).
- Registrations dialog already sorts `is_group_contact` first — the existing "Group Contact" card stays, but the table will now also include them, and the count will include them.
- CSV export already iterates `registrations`, so they'll be included automatically.

### C. Add "Add person" inside the Registrations dialog
- New "+ Add Person" button in the dialog header (next to Export to CSV).
- Opens a compact inline form: First name, Last name, Phone, Email, Fitness level (1–5), Injuries, Birthday, Weight, plus a `Group Contact` toggle (defaults off; if on, also updates `vip_sessions.reserved_contact_*` so the two stay in sync).
- Insert into `vip_registrations` with `vip_session_id`. Realtime subscription already in place will refresh counts on every card instantly.
- Reuse `FormHelpers` (`formatPhoneAsYouType`, `autoCapitalizeName`) and existing styling — no new components, no new libraries.

### D. Verify cross-surface coherence (per workspace rules)
After the fix, confirm with real data:
- Bama Dining May 22 card shows `5 registered` (or `6` after promoting Nicole).
- Registrations dialog shows the same number, with Nicole listed as Group Contact at top.
- Pipeline → VIP Scheduler tab and VIPs page both show identical counts (same component, same query).
- `VipPerformanceDashboard` "Total Attendees" still works (it reads `vip_registrations.outcome` + `vip_sessions.actual_attendance`, not affected).
- CSV export includes the group contact row.

### Technical details

Files touched:
- `src/features/pipeline/components/VipSchedulerTab.tsx` — fix select, add "+ Add Person" form, wire group-contact upsert when marking reserved.
- One Supabase migration: backfill `vip_registrations` rows for existing reserved sessions whose `reserved_contact_name` is set but who have no matching registration. Idempotent (`ON CONFLICT DO NOTHING` on a name+phone+session match, or guarded with `NOT EXISTS`).

Out of scope (won't touch):
- `VipPipelineTable` — it lists VIP-sourced intro bookings, not registrations; not the source of the mismatch.
- `VipPerformanceDashboard` quarterly metrics.
- Public `/vip-availability` flow.

### Confirm before I build
1. When adding a person via "+ Add Person", should the default `lead_source` story stay as just a registration (no intro booking auto-created), or should I also expose the existing "Book Intro" flow from inside that form? My default: just register; staff can still hit Book Intro on the card afterward.
2. For the one-time backfill of existing reserved sessions' group contacts into `vip_registrations` — proceed for all historical reserved sessions, or only future-dated ones?
