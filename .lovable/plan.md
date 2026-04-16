

## Root cause

VIP registrations and VIP pipeline are reading from **two completely different sources**:

- **Scheduler ("8 registered" for Phi Gam)**: counts `vip_registrations` rows linked by `vip_session_id` → 8 ✅
- **VIP Pipeline tab ("0")**: reads `intros_booked` rows where `lead_source = 'VIP Class'` AND `vip_class_name` matches the group → 0 ❌

For Phi Gam, all 8 registrants exist in `vip_registrations` with `vip_session_id` set, but **no `intros_booked` row was ever created for them**, and `vip_class_name` on the registrations is `"Phi Gam Fraternity"` (the `reserved_by_group`) — while the session's `vip_class_name` is `"VIP Sun Apr 19"` (the auto-generated date label). The Pipeline table groups by booking, not by registration, so registrants without bookings are invisible.

This is a structural mismatch, not a bug in one place. Fixing only the count (e.g., counting registrations on the Pipeline side) would still hide every registrant's name, phone, email, biometrics, and waiver from the Pipeline.

## Fix — make Pipeline VIP table the single source of truth, fed by registrations

Rewrite `VipPipelineTable.fetchData` so the row source is `vip_registrations` (not `intros_booked`), with bookings joined in optionally.

### New row build logic
For every visible VIP session (joined to `vip_sessions`):
1. Pull every `vip_registrations` row where `is_group_contact = false`
2. Group label = `vip_sessions.reserved_by_group` (fallback to `registration.vip_class_name`, then `vip_sessions.vip_class_name`)
3. If `registration.booking_id` is set → join `intros_booked` for status/session/owner/etc.
4. If no booking yet → row still appears with status `"Registered – No booking"`, all biometric data visible, and a clear "Create booking" affordance (uses existing convert-to-intro flow with the registration pre-filled)

### Group list (left rail)
Build from `vip_sessions` where `reserved_by_group` is not null and `archived_at` is null — match the Scheduler exactly. Counts come from `vip_registrations` keyed by `vip_session_id`, so Pipeline and Scheduler show identical numbers everywhere.

### Same fix applied to the VIP tab on `/my-day` 
`VipRegistrationsSheet` already reads `vip_registrations` correctly — verify the count shown on the My Day VIP card uses the same registration count, not a booking count. Audit `IntroDayGroup` / `useUpcomingIntrosData` for the VIP "X registered" pill to confirm.

## Files changed

1. `src/features/pipeline/components/VipPipelineTable.tsx` — rewrite `fetchData`, `groupCounts`, row type to be registration-anchored with optional booking join. Update group list source.
2. `src/features/myDay/useUpcomingIntrosData.ts` (verify only) — ensure VIP count uses `vip_registrations` count keyed by `vip_session_id`.
3. `src/components/admin/VipGroupDetail.tsx` (audit) — same root-cause check; fix if it counts bookings instead of registrations.

## Downstream effects

- Pipeline VIP group counts (pills) will match Scheduler exactly
- Phi Gam (and every group with registrations but no bookings) will now show all 8 members with full form data
- Members without bookings get a visible "Create booking" action (won't silently disappear)
- Convert-to-intro, manual add, bulk assign, archive, delete flows continue working — just operate on the joined booking when present
- No metric/attribution changes — VIP is already isolated from intro funnel per `VIP Isolation` memory
- No DB schema changes; no RLS changes

## Confirm before I build

1. For registrants with **no booking yet**, should the Pipeline row show a "Create booking" button (uses existing convert-to-intro dialog), or just display them read-only with a "Registered – No booking" badge?

