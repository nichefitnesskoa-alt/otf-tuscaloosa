## Problem

WIG tile says **72**. The "Sourced Leads" dialog says **41** for the same SAs because:

1. **Different date range.** WIG tile uses the calendar **month** (`dateRange` prop = June). The dialog defaults to **Pay Period** (Jun 15–28).
2. **Different rules.** The two count different things:

| Rule | WIG tile (`useSaLeads`) | Dialog (`useSourcedLeadsInRange`) |
|---|---|---|
| `leads` source filter | Drops `Lead Management` + `Online Intro Offer (self-booked)` | No source filter |
| `intros_booked` child bookings (rebook / 2nd intro) | Excluded | Included |
| `intros_booked.ignore_from_metrics` | Excluded | Included |
| VIP registrants (no booking yet) | Counted, credited to `vip_sessions.sa_setup_name` | Not counted |
| Active-SA filter | Yes (matches leaderboard) | No |
| Dedup | None — each row counts once | last-10 phone digits |

So 41 ≠ 72 is structural, not a render bug. They will never agree until they share a source.

## Fix — one source of truth

Drop `useSourcedLeadsInRange` as a parallel implementation. Have the dialog read **the same rows the WIG tile already aggregates** via `useSaLeads(rangeStart, rangeEnd)`, which exposes per-SA `people[]` with stable ids (`lead-…`, `bk-…`, `vip-…`).

Result: the dialog total will always equal the WIG tile total for the same date range. If duplicates exist (same person counted under two SAs / two ids), they show up as separate rows the user can see and act on — exactly what was asked for ("if there are duplicate names the 72 should change").

### Dialog changes (`SourcedLeadsDialog.tsx`)

1. **Default the dialog's date range to the WIG-selected range** (pass `dateRange` from `WigSaLeaderboard` as a prop). Date picker still works — user can switch. No more silent month-vs-pay-period mismatch.
2. **Replace data hook** with `useSaLeads(rangeStart, rangeEnd)`. Flatten `rows[].people[]` into one list, attaching the SA name to each row.
3. **Map to existing row shape** so the rest of the UI (grouping, checkbox, CSV) stays the same:
   - `lead-{id}` → real leads row → manual Mindbody import checkbox writes `leads.mindbody_imported_at`.
   - `bk-{id}` → already booked → checkbox auto-checked + disabled (label "In Mindbody (booked)"), same as today.
   - `vip-{id}` → VIP registrant, not yet booked → manual import checkbox writes to a new `vip_registrations.mindbody_imported_at` / `_by` (mirrors the leads columns added last build).
4. **Phone, source, created_at, booked flag** all come from `SaLeadPersonRow` (already present). For VIP registrants `phone` is not in the existing shape — extend `useSaLeads` to also select `phone` from `leads` / `intros_booked` / `vip_registrations` and pass it through on `SaLeadPersonRow`.
5. **Counts shown on the Status filter chips and the big total tile** stay live-derived from the same list. With `useSaLeads` they will sum to the WIG tile.
6. **CSV unchanged in shape** — still writes one row per visible record, including `source_type` (`lead` / `booking` / `vip_registrant`).

### DB change

Add to `vip_registrations`:
- `mindbody_imported_at timestamptz null`
- `mindbody_imported_by text null`

(Mirrors the columns already on `leads`. Same GRANTs as the existing table.)

### Hook changes

- `useSaLeads`: also select `phone` and `mindbody_imported_at` / `_by` for each source (leads + bookings + registrations) and surface them on `SaLeadPersonRow`. No change to counting logic — counts must stay identical to today so the WIG tile doesn't move.
- `useMarkLeadImported`: branch by id prefix — `lead-…` writes `leads`; `vip-…` writes `vip_registrations`. `bk-…` rejected (already booked).
- Delete `useSourcedLeadsInRange.ts` (no longer used).

### Coherence proof I will run before reporting done

- `useSaLeads(June)` total per SA in DB ≡ WigSaLeaderboard total ≡ dialog total tile. All three numbers named in proof block.
- Same check for current Pay Period.
- Verify the dialog list count == status-filter chip sum (`needs + in_mindbody == all`).
- Verify CSV row count == on-screen row count.
- Verify marking a `vip-…` row imported persists to `vip_registrations.mindbody_imported_at` and survives a refetch.

### Out of scope

- No changes to what counts toward the WIG tile. Same definitions.
- No Mindbody API integration — still manual checkoff only.

### Files

- edit `src/components/wig/WigSaLeaderboard.tsx` — pass `dateRange` to `SourcedLeadsDialog`.
- edit `src/components/wig/SourcedLeadsDialog.tsx` — switch data source, accept `dateRange` prop, default to it.
- edit `src/hooks/useSaLeads.ts` — surface `phone` + `mindbody_imported_at/_by` on `SaLeadPersonRow`.
- edit `src/hooks/useMarkLeadImported.ts` — branch by id prefix; write to `vip_registrations` when prefix is `vip-`.
- edit `src/lib/sa/sourcedLeadsCsv.ts` — accept `source_type: 'lead' | 'booking' | 'vip_registrant'`.
- delete `src/hooks/useSourcedLeadsInRange.ts`.
- migration: add two columns to `vip_registrations`.
