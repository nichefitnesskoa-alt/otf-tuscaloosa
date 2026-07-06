## Goal

1. When a booked lead shares their friend-link and someone books through it, that friend-booking already gets the `(Friend)` lead source — but it should also count toward the SOML referral pipeline (pending referral, then realized if they buy).
2. Add a new **Referral Leads** goal to the SOML WIG section, side-by-side with the existing **Referrals that Close** goal. Two separate targets, two separate columns.

## Part 1 — Friend-link bookings create pending referrals

Currently `soml_create_pending_referral` trigger only fires when `lead_source IN ('Member Referral', 'Member Referral (5 class pack)')`. Friend-link bookings (`Intro Scheduler Link (Friend)`, `Instagram DMs (Friend)`, etc.) have `paired_booking_id` set to the originator and `referred_by_member_name` set to the originator's first name, but no pending referral row is created.

Migration to expand the trigger:
- Also fire when `NEW.paired_booking_id IS NOT NULL` (the "someone brought a friend" signal), regardless of lead_source. This catches every `(Friend)` variant.
- `referring_member` = originator booking's `member_name`.
- `credited_sa` = originator booking's `booked_by`/`intro_owner` (the SA whose link started the chain), same fallback rules as today.
- Reuses the existing chain-root dedup so reschedules don't create duplicates.

The existing `soml_resolve_pending_referral` trigger already flips these rows to `realized` on sale — no change needed.

## Part 2 — "Referral Leads" as its own SOML goal

Data (in `useSomlData`):
- Add a fourth metric `referralLeads` alongside `referrals` / `upgrades` / `sales`.
- Count: pending-referral rows whose **booking's `class_date`** falls inside the SOML window (any state: pending, realized, or not_converted) — a referral lead counts the moment the friend is booked in-window, not when they buy.
- Per-SA: `credited_sa` on the pending row.
- Returns a new `referralLeadsList` for drilldown.

Config:
- Add `referral_leads_goal` column to `soml_config` (default 0). Read/write alongside the existing three goals.

UI (`SomlSection.tsx`):
- Fourth `HeroTile` for "Referral Leads" (Users icon), same pace/edit/drilldown pattern as the others.
- New column in the per-SA leaderboard table, same override behavior (`soml_sa_goals.referral_leads_goal` column, per-SA override dialog gains the new metric).
- Rename existing tile from "Referrals" → "Referrals that Close" to make the distinction obvious.

Migration:
- `ALTER TABLE soml_config ADD COLUMN referral_leads_goal int NOT NULL DEFAULT 0;`
- `ALTER TABLE soml_sa_goals ADD COLUMN referral_leads_goal int;`

## Coherence check (before done)

- Verify one friend-booking now yields a `soml_pending_referrals` row with correct `credited_sa` and `referring_member`.
- Verify the same row realizes to a Close on sale (Referrals-that-Close +1) — no double-count.
- Verify Referral Leads count matches pending-referral rows with in-window class_date.
- SA per-row totals across all four columns match the SA-level pending/realized/sales rows.

## Files touched

- New migration (trigger update + two columns).
- `src/hooks/useSomlData.ts` — add referralLeads metric + list.
- `src/features/wig/soml/SomlSection.tsx` — new tile, new column, override dialog, edit-goal dialog, rename copy.
- `src/pages/Wig.tsx` — only if it references the SOML metric shape (likely just re-renders).
