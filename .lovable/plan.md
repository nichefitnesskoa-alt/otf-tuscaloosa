REACH MAP for missing intros in drilldowns
- Tables read: `intros_booked`, `intros_run`, `fv_scorecards`. Sometimes seeded from a `leads` row.
- Resolver: `src/lib/person/resolvePerson.ts` — single source of truth for "who is this person across all intros".
- Consumers of `resolvePerson` / `PersonJourneyCard`: WIG SA Leaderboard drilldown, WIG tab journey popups, Pipeline (`PipelinePage.tsx`), SA Detail (`pages/SaDetail.tsx`).
- No metric/commission/attribution logic changes. Read-only fix.

What's actually broken
- Emma Hensley: booking `cebdb15b…` exists (Jayna, 6/17), run `bc63221d…` (NO_SHOW). Popup says 0 intros.
- Christian Kazoleas: booking `108c23f8…` exists (Jayna, 6/20), run `858437b8…` (NOT_INTERESTED). Popup says 0 intros.
- Root cause: `resolvePerson` is a single-strategy resolver. It tries phone, then email, then name — but ONLY falls back to name when BOTH phone and email are absent on the seed. And the phone query uses `phone.ilike.%2175867614%` against values stored as `(217) 586-7614`, which never matches contiguous digits. Result: seed has a phone, phone match returns nothing, email/name fallbacks are blocked, popup shows 0.
- The Emma/Christian drilldown rows are seeded from `leads` rows (no `bookingId`), so the resolver gets only name + phone from the lead — never reaches the real booking.

Plan: make `resolvePerson` a true multi-strategy union matcher
1. Normalize once, match in parallel. Compute `seedPhone10`, `seedEmailNorm`, `seedNameNorm` from whatever the seed provides (bookingId, lead row, free-form identifier). Run every applicable strategy independently and UNION the resulting booking IDs — no early exit, no "phone present means skip name".
2. Phone strategy fixed to actually work.
   - Match on `phone_e164 = +1{ten}` (exact).
   - Also pull `phone IS NOT NULL` candidates whose normalized 10-digit form equals `seedPhone10` — normalize in TypeScript using the existing `stripCountryCode` helper, since stored `phone` is free-form (`(217) 586-7614`, `217-586-7614`, `2175867614`, etc.). To keep it cheap, narrow with a server-side `phone.ilike` that uses the last 4 digits (`%{last4}%`), then verify in code.
3. Email strategy unchanged in spirit, hardened: case-insensitive exact match on normalized email; verify in code.
4. Name strategy promoted to a real matcher.
   - Run an `ilike` on `member_name` for the trimmed seed name.
   - Verify in code: normalized name equality.
   - Risk control: when a name-only candidate has its own phone or email that does NOT match the seed's phone/email, treat it as a different person and skip. When the seed has no phone or email at all, keep the existing "matched by name only" badge.
5. Lead-seed support. If caller passes a `leadId` (or a richer identifier including phone+email+name from a lead row), use ALL of those as seeds. Today most drilldown callers pass `bookingId`; the lead-row drilldown opens with no booking, so add a small helper so callers can pass `{ leadId }` and the resolver loads `first_name,last_name,phone,email` from `leads` and seeds from those.
6. Output unchanged shape. `bookingIds` is the union, sorted oldest-first. `method` reports the strongest strategy that produced a hit (`phone` > `email` > `name_only`). `nameOnlyMatch` is true ONLY when the union has matches but none came from phone or email.
7. No change to attribution, commission, sourced-leads count, sales count, close rate, follow-up ownership, or any metric. Pure read-path fix.

Verification (must produce COHERENCE PROOF before reporting done)
- Emma Hensley drilldown popup resolves booking `cebdb15b-0a22-42f6-bb8f-3e6ade91393c` and run `bc63221d-160c-4ba2-99a2-3751d1c059d1`. Header shows 1 intro.
- Christian Kazoleas drilldown popup resolves booking `108c23f8-da43-4a0f-acb8-8082204db0ac` and run `858437b8-8af3-4d40-83fe-66801381767e`. Header shows 1 intro.
- Spot-check a phone-only seed (no booking, no email) that previously failed and now resolves via name.
- Confirm a non-matching same-name person does NOT get merged in (different phone/email on the candidate → skipped).
- WIG SA Leaderboard totals (SGL, Booked, Sales) unchanged — those use `useSaLeads` / `useSaAllBooked` / `useSaSales`, not `resolvePerson`.

Files expected to change
- `src/lib/person/resolvePerson.ts` — rewrite as multi-strategy union resolver, add optional `leadId` seed support.
- `src/components/wig/WigSaLeaderboard.tsx` (only if needed) — pass `{ leadId }` for lead-seeded rows (`lead-{uuid}`) instead of `{ bookingId: p.booking_id }` when `booking_id` is null.

No DB writes. No schema changes. No new helpers; this IS the canonical helper.