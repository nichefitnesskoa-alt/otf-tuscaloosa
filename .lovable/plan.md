## Problem

Referral Leads (SOML) currently only counts a pending-referral row if the booking's `class_date` (or created_at fallback) falls inside the SOML window. That means someone like Brent Rogers — booked before the window but who *realizes* (buys) inside the window and gets credited to Zoe — shows up in Zoe's **Referrals** (realized) column but NOT in Zoe's **Referral Leads** column.

Any realized referral in the window should always also count as a referral lead for the same SA, no matter when the original booking happened.

## Fix

In `src/hooks/useSomlData.ts`, expand the `referralLeadsItems` builder so an enriched pending row qualifies as a referral lead if EITHER:

1. Its class_date / created_at is inside the window (current behavior), OR
2. It realized inside the window (`state === 'realized'` and `realized_at` between `start` and `end`) — credited to the same `credited_sa` used for the Referrals metric.

Dedupe by pending-row `id` so a row that satisfies both conditions only counts once. The SA credit stays `credited_sa` (same field the realized/pending logic already uses), so Referral Leads and Referrals stay attributed to the same person for the same member.

No other files need to change — every consumer (`SomlSection`, drilldowns, WIG SOML tile, Own It deck Slide04Soml) reads `referralLeadsList` / `rows[].referralLeads` from this hook.

## Coherence checks I'll run before reporting done

- Confirm Brent Rogers' pending row: `credited_sa`, `state`, `realized_at`, booking `class_date`.
- Query SOML window; verify Brent now appears in Zoe's referral-leads list AND still appears exactly once in Zoe's realized referrals.
- Verify `totals.referralLeads` = distinct pending rows meeting either condition (no double count).
- Spot-check another SA to confirm nobody else's numbers moved unexpectedly.

## Files touched

- `src/hooks/useSomlData.ts` (only)
