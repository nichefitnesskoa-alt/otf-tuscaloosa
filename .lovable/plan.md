## Problem

When Kaiya sets up a VIP class (e.g. Nothing Bundt Cakes) and 7 people register, she gets **zero** credit on the WIG SA leaderboard's Leads column until those registrants actually book a 1:1 intro. The screenshot confirms: 7 registered, 7 showed, 0 booked an intro → Kaiya's WIG shows 0 leads from this class.

The SA who set up the VIP class did the sourcing work. Each registrant is a self-generated lead and should count immediately on the date they registered.

## Root cause

`src/hooks/useSaLeads.ts` (the WIG "Leads" metric) only reads two sources:

1. `leads` rows tagged with `sourced_by_sa`
2. `intros_booked` rows with a self-sourced `lead_source` (e.g. `VIP Class`)

VIP registrants live in `vip_registrations` and are not written to either table at registration time, so they are invisible to the metric.

## Fix

Add `vip_registrations` as a **third source** in `useSaLeads`, attributed to `vip_sessions.sa_setup_name` (the canonical SA-who-set-up-the-VIP field already shown in the drawer).

### Counting rules (each person exactly once)
- Count a registration when:
  - `is_group_contact = false` (organizers are not leads)
  - `vip_session_id` is set AND that session has a non-phantom `sa_setup_name`
  - `created_at` falls in the WIG date range (America/Chicago)
- **Dedup** to avoid double-counting when the same person later books an intro:
  - If `vip_registrations.booking_id` is set AND that booking already appears in the existing `candidateBookings` set (path 2), skip the registration row — the booking wins.
  - If a `leads` row is already attributed to the same person via `sourced_by_sa`, the leads-row path already counts them; skip when `booking_id` is linked through `leads.booked_intro_id` too.
- Credit goes to `vip_sessions.sa_setup_name` (never `booked_by`, never the session coach).

### Files touched
- `src/hooks/useSaLeads.ts` — add the third query (`vip_registrations` joined to `vip_sessions` for `sa_setup_name`), apply the dedup, push rows into the aggregator using id format `vip-{registration_id}`. Add `'vip_registrations'` to the realtime invalidation scope list so new registrations refresh WIG live.
- `src/lib/sa/leadsBooked.ts` — no logic change; reuse `PHANTOM_BOOKED_BY`. Add a short comment noting VIP registrants are now the third self-sourced surface so future readers find it.
- `removeSelfSourcedRow` — extend to handle `vip-{id}` by clearing `vip_session_id` on that registration (removes credit without deleting the registrant record).

### Cross-page consumer check
- `useSaLeads` is consumed by the WIG SA Leaderboard (Leads tile + per-SA column + drill-down) — all three update from the same hook, so they stay in sync automatically.
- `useSaLeadsBooked` (the "Booked" column) is unchanged: it only counts booked intros, which is correct — VIP registrants haven't booked an intro yet.
- `useSaSales`: unchanged; sales attribution still flows from intros_run.
- VIP drawer numbers ("7 registered / 7 showed / 0 booked an intro") are unaffected — those read directly from registrations/bookings, not from this hook.

### Verification before reporting done
- Pick Kaiya + the Nothing Bundt Cakes session, query `vip_registrations` where `vip_session_id = <session> AND is_group_contact = false` → confirm 7 rows.
- Query `vip_sessions` for that session → confirm `sa_setup_name = 'Kaiya'`.
- Confirm WIG Leads tile for Kaiya in the matching week now reflects 7 additional credits (or however many of the 7 fall in the selected range).
- Confirm a registrant who later books an intro is counted exactly once (registration row suppressed by dedup once their booking exists).
- Confirm `useSaLeadsBooked` ("Booked" column) is unchanged for that SA — VIP registrants who have not booked an intro do not inflate Booked.
