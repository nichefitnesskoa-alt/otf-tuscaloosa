No the showing names issue was for the notifications I was getting on the front of the page when people registered not anything to do with function of the VIP things itself. Getting too many useless notifications so go back and fix that too. I do want to see names in the VIP group card etc, just not the notifications/alerts  
  
Goal

Restore the ability to log a per-attendee outcome on the My Day VIP card — without showing names. Each row in the registrant list becomes anonymous ("Attendee 1, Attendee 2, …") with the same outcome dropdown that existed before.

## Changes

`**src/features/myDay/VipRegistrationsSheet.tsx**`

- Re-add the per-registrant list, but render anonymously:
  - Row label: `Attendee {index}` (1-based, sorted by `created_at` for stable ordering). No name, no phone, no email, no birthday, no fitness/injury fields — ever.
  - Row control: outcome `<Select>` with the same options as before:
  `showed`, `no_show`, `interested`, `not_interested`, `booked_intro`, `purchased`
  - On change → `update vip_registrations set outcome = ? where id = ?`, optimistic local state update, toast "Saved".
- Keep the aggregate count + outcome roll-up at the top of the body (unchanged from current).
- Keep the coach picker at the top (unchanged).
- Keep the "Booked an intro from this group?" helper banner at the bottom (unchanged).
- Query update: fetch `id, outcome, created_at` from `vip_registrations` (still excludes `is_group_contact = true`). No PII columns selected.

**Layout order inside the sheet:**

1. Coach picker (existing)
2. Aggregate count card with outcome roll-up (existing)
3. **NEW: Anonymous attendee list** — one row per registrant: `Attendee N` label + outcome dropdown
4. Helper banner (existing)

## Files audited, no change needed

- `vip_registrations` schema — unchanged. `outcome` column already exists.
- `OutcomeDrawer.tsx` — unchanged. The "VIP Class Intro (not expected to buy)" outcome on actual intro cards stays as-is.
- Reporting (`Wig.tsx`, `PerCoachTable.tsx`, `useDashboardMetrics.ts`) — unchanged.
- VIP signup flows — unchanged.
- RLS / role permissions — unchanged.

## Downstream effects

- My Day VIP card now shows: group name, total count, coach picker, anonymous attendee list with outcome dropdowns, outcome roll-up, helper banner.
- Per-attendee outcomes save to `vip_registrations.outcome` (same column the legacy flow used) — outcome roll-up at top reflects new selections in real time via local state.
- Privacy preserved: no names, phones, or PII rendered anywhere on the card.
- No effect on any other surface.
- Central Time conventions preserved.