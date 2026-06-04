## Diagnosis (what's there now, before any build)

**1. Self-sourced predicate (booked side) — already canonical**
`src/lib/sa/leadsBooked.ts → isSelfGeneratedLeadBooked` excludes two sources: `Lead Management` and `Online Intro Offer (self-booked)`. Every other source (incl. all "(Friend)" variants and VIP Class) counts as SA-sourced. Credit goes to `vip_sessions.sa_setup_name` for VIP Class bookings, otherwise `booked_by` (with phantom names filtered).

**2. SA Leaderboard — current shape**
`WigSaLeaderboard.tsx` has TWO columns today: **"Leads booked"** (which is `useSaLeadsBooked` = self-sourced BOOKED only) and **"Sales"** (`useSaSales`). It does NOT currently show "all booked intros" — your prompt says "Booked column keeps counting all booked (inbound + sourced)" but that's not what ships today. **I need to confirm intent before building** (see Question below).

**3. Storage for un-booked leads**
`leads` table exists (first/last/phone/email/source/stage/booked_intro_id). It has NO column for "which SA sourced this lead." `AddLeadDialog` already inserts into it but doesn't capture an SA. So an un-booked SA-sourced lead has no home today — we need one new column.

**4. Hooks feeding the leaderboard**
`useSaLeadsBooked` (booked SGL) + `useSaSales`. Both listen to `DATA_CHANGED_EVENT` and bucket CST. A new `useSaLeads` will sit alongside, same shape, same invalidation pattern.

---

## Open question (must answer before I build)

The prompt's scope-guard says "Booked column keeps counting all booked intros (inbound + sourced) as established." That contradicts what ships — today's "Leads booked" column counts SGL booked only (inbound excluded). Two ways to land this:

- **Option A (matches prompt literally):** Rename current column to **"Booked"** and change it to count ALL booked intros (inbound + sourced). Add new **"Leads"** column = self-sourced leads (booked + unbooked). This is a real change to the existing booked metric and would shift every SA's number upward (inbound bookings now count).
- **Option B (preserves current metric):** Keep current column as **"SGL booked"** (unchanged), add new **"Leads"** column = self-sourced leads not-yet-booked (or total self-sourced people; both flavors are possible). No existing number moves.

I'll ask you to pick before writing code.

---

## Proposed build (pending your answer above)

### Data

- Add `leads.sourced_by_sa text NULL` (no default; null = not SA-sourced / inbound). Backfill nothing. No new table — `leads` already has everything else (name, contact, source, `booked_intro_id` for conversion link, `created_at` CST-bucketable).
- Shared predicate: extract `isSelfSourcedLeadSource(source)` into `src/lib/sa/leadsBooked.ts` (same exclusion set as `isSelfGeneratedLeadBooked`) and reuse it from both the booked path AND the new leads path. Single source of truth — a sourced lead and a sourced booking always agree.

### Canonical hook

- `src/hooks/useSaLeads.ts`: per-SA self-sourced lead count for a date range. Reads `leads` where `sourced_by_sa is not null` and `source` passes the shared predicate, bucketed by `created_at` CST. Returns same row shape as `useSaLeadsBooked` so Own It / other surfaces can swap.

### Lead entry from My Day

- New component `SelfSourcedLeadEntry` (reused on WIG if trivial). Fields: first/last/phone/email + source dropdown (limited to non-inbound options) + optional "Book intro now" toggle that opens existing intro-booking write path inline.
  - Always sets `sourced_by_sa = currentUser.name`.
  - If "Book now" is on: writes the lead AND the intro booking (with `booked_by = currentUser.name`), so the person counts in BOTH Leads and Booked via existing logic.
- Helper text on the surface itself:
  > "Only log leads YOU personally sourced. Do not log inbound leads (lead management, online intro offer) — those count when you book them."
- Inline guard: if user types or selects an inbound source, block submit and explain.

### Leaderboard column

- Add **Leads** column to `WigSaLeaderboard` between SA name and existing Sales/Booked columns. Reads from `useSaLeads`. Tap-to-drill shows the person list (sourced lead row → if booked, also link to journey card).
- Add one-line clarifier under the section title (exact text per Option A or B chosen).

### Coherence proof I'll run before reporting done

1. Log SGL with no booking → appears in Leads, not in Booked.
2. Log SGL + book in same flow → appears in BOTH Leads and Booked for that SA.
3. Book an inbound lead (Lead Management / plain Online Intro Offer) → Booked only, never Leads.
4. Leaderboard Leads number === `useSaLeads` total for the same SA & range.
5. Shared predicate test: same source string → same self-sourced answer in both leads path and booked path.

### Scope guard honored

No change to `useSaSales`, close-rate logic, commission, or follow-up ownership. Only the booked-intro column may shift IF you pick Option A; Option B leaves it untouched.

---

## What I need from you

Pick **Option A** (change current "Leads booked" → "Booked" = ALL booked intros, then add new "Leads" = self-sourced) or **Option B** (keep current column as-is, just add a new "Leads" column). I'll build immediately after.

&nbsp;

I choose Option A