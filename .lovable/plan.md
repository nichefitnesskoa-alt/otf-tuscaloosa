## Goal
Guarantee that every booking made through an SA's Intro Scheduler Link (short `/book-intro/<code>` URL, its `-eventShort` variant, or its friend `/book-intro/f/<code>` variant) credits that SA as a **self-generated lead** on the WIG SA Leaderboard — and add a safeguard so an existing lead's original SA credit can never be silently overwritten.

## What's already correct (verified by reading the code)

In `src/pages/BookIntro.tsx` the insert already sets the fields WIG reads:

- `intros_booked.booked_by = ctx.sa` and `scheduler_link_sa = ctx.sa`
- `intros_booked.lead_source = 'Intro Scheduler Link'` (or `'Intro Scheduler Link (Friend)'`)
- `leads.sourced_by_sa = ctx.sa`, `source = ctx.source`, `booked_intro_id = newBookingId`

`isSelfSourcedLeadSource()` in `src/lib/sa/leadsBooked.ts` only excludes `Lead Management` and `Online Intro Offer (self-booked)`, so both `Intro Scheduler Link` and `Intro Scheduler Link (Friend)` pass. `useSaLeads.ts` aggregates from `leads.sourced_by_sa` first and falls back to `intros_booked.booked_by`, deduped by `booked_intro_id`. So the SA already gets exactly one self-sourced credit per booking.

## The one real gap

In `BookIntro.tsx` the "existing lead" branch does:

```
await supabase.from('leads').update({
  booked_intro_id: newBookingId,
  stage: 'booked',
  source: ctx.source,
  sourced_by_sa: ctx.sa,        // ← overwrites whoever originally sourced the lead
}).eq('id', existingLead.id);
```

If SA-A originally logged the lead and later SA-B's link is used to book, SA-B silently steals SA-A's credit. Fix: only set `sourced_by_sa` / `source` when the existing lead has none. Otherwise keep the original.

## Changes

1. **`src/pages/BookIntro.tsx`** — existing-lead update:
   - Select `sourced_by_sa, source` on the dedup query.
   - Build the update payload conditionally:
     - Always set `booked_intro_id`, `stage: 'booked'`.
     - Set `sourced_by_sa: ctx.sa` **only if** the existing row's `sourced_by_sa` is null/empty.
     - Set `source: ctx.source` **only if** the existing row's `source` is null/empty.

2. **Add a small self-check log** (dev-only `console.info`) after insert:
   `[IntroLink] credited SA=<ctx.sa> source=<ctx.source> booking=<id> lead=<id>`
   so we can eyeball the flow during QA without adding UI.

3. **No changes to** `useSaLeads.ts`, `leadsBooked.ts`, or WIG components — they already count these correctly.

## Coherence proof (to run after build)

- `SELECT id, booked_by, scheduler_link_sa, lead_source, created_at FROM intros_booked WHERE via_scheduler_link = true ORDER BY created_at DESC LIMIT 10;` → every row has a real SA in `booked_by` and a self-sourced `lead_source`.
- For the same SA + window, `useSaLeads` count on WIG must equal COUNT(distinct booking) from that query where the lead is deduped. Confirm the number on the WIG SA Leaderboard tile matches.
- Booking made from SA-B's link against a lead already owned by SA-A → `leads.sourced_by_sa` stays SA-A; WIG credit stays with SA-A; SA-B gets no phantom credit; booking still appears under SA-B's "Booked" column via `booked_by`.

## Out of scope
No schema changes. No changes to `intro_link_codes`, VIP/event handling, or the friend-flow originator inheritance (already correct).