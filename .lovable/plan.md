## Root cause

The My Day "VIP group" intro card (`VipRegistrationsSheet`) reads people exclusively from the **`vip_registrations`** table, filtered by `vip_session_id`.

The Pipeline "Add Member" button (`VipPipelineTable.handleAddMember`) only inserts into **`intros_booked`** with a `vip_class_name`. It does NOT write a `vip_registrations` row, and it does NOT set `vip_session_id`. So manually added people are visible in the Pipeline VIP table (which knows how to read both sources) but invisible to the My Day card.

Confirmed in the live data for Bama Catholic:

```text
vip_sessions row:        Bama Catholic → session_id 0bd3...82d
vip_registrations rows:  12 people, all linked to that session_id  ✅ shown in My Day card
intros_booked "Elise":   vip_class_name="Bama Catholic", vip_session_id=NULL, no matching registration  ❌ missing from card
```

A second Elise row also exists with `vip_session_id` filled but `vip_class_name` NULL — created by a separate flow (likely conversion). Neither one produces a registration row.

## What to fix

### 1. Pipeline → "Add Member" must write the registration row

In `src/features/pipeline/components/VipPipelineTable.tsx` `handleAddMember`:

- Look up the target group's `vip_sessions.id` from `groupMetas` (already loaded as `selectedGroupMeta`).
- Split the typed name into `first_name` / `last_name` (first token vs. rest, mirroring `auto_create_questionnaire`).
- Insert into `vip_registrations` with: `first_name`, `last_name`, `phone`, `email`, `vip_class_name = targetGroup`, `vip_session_id = session.id`, `is_group_contact = false`, `booking_id = newBooking.id`.
- Keep the existing `intros_booked` insert, but also stamp `vip_session_id = session.id` on it so the two sides are linked both ways.
- If no `vip_sessions` row exists yet for that group name, create one first (mirrors the existing pattern at line 630 / 497) so we always have a session id to attach to.

### 2. Backfill Elise (and any other orphans)

One-time migration:

```sql
-- For every intros_booked row that is a VIP-class booking with no matching
-- vip_registrations row, create the registration and link booking ↔ session.
INSERT INTO vip_registrations (first_name, last_name, phone, email,
                               vip_class_name, vip_session_id,
                               booking_id, is_group_contact)
SELECT
  split_part(b.member_name, ' ', 1),
  NULLIF(substring(b.member_name FROM position(' ' IN b.member_name) + 1), ''),
  b.phone, b.email,
  COALESCE(b.vip_class_name, s.vip_class_name, s.reserved_by_group),
  COALESCE(b.vip_session_id, s.id),
  b.id,
  false
FROM intros_booked b
LEFT JOIN vip_sessions s
  ON s.reserved_by_group = b.vip_class_name
  OR s.vip_class_name    = b.vip_class_name
WHERE b.lead_source = 'VIP Class'
  AND b.deleted_at IS NULL
  AND COALESCE(b.vip_session_id, s.id) IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM vip_registrations r WHERE r.booking_id = b.id
  );
```

Plus a small UPDATE to fill `intros_booked.vip_session_id` when null:

```sql
UPDATE intros_booked b
SET vip_session_id = s.id
FROM vip_sessions s
WHERE b.lead_source = 'VIP Class'
  AND b.vip_session_id IS NULL
  AND b.deleted_at IS NULL
  AND (s.reserved_by_group = b.vip_class_name OR s.vip_class_name = b.vip_class_name);
```

### 3. Safety net — DB trigger so this never silently desyncs again

Add an `AFTER INSERT` trigger on `intros_booked` that, when `lead_source = 'VIP Class'` AND `vip_session_id IS NOT NULL` AND no `vip_registrations` row exists for that booking, auto-creates one. This protects against any other code path (conversion flow, future imports) that forgets to write the registration.

## Files touched

- `src/features/pipeline/components/VipPipelineTable.tsx` — fix `handleAddMember`
- New Supabase migration — backfill + trigger

## Downstream effects checked

- **My Day VIP group card**: Elise (and any past orphans) appear immediately after backfill; future manual adds appear in real time.
- **Pipeline VIP table**: Already merges registrations + orphan bookings, so no change in behavior for existing data; orphans simply become non-orphans.
- **VIP roster / scheduler**: Reads `vip_registrations` by session — gains the missing rows, which is the desired behavior.
- **Convert-to-real-intro flow**: Still works — `ConvertVipToIntroDialog` already updates `vip_registrations.booking_id`, and the new trigger is no-op when a registration already exists.
- **Outcome logging in the My Day card**: Now possible for manually added people (was impossible before because they didn't appear).

## Out of scope

- No UI changes to the My Day card itself.
- No changes to the public VIP registration form.
- No changes to attribution / coach-credit logic.
