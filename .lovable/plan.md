## Goal

Three changes to the Self-Sourced Leads dialog:

1. **Explain the 53 vs 72 gap** and optionally widen the definition.
2. **Filter for "already booked"** so Koa can hide leads that don't need Mindbody import.
3. **Per-lead "Imported to Mindbody" checkbox** so SAs can mark each one off as they import.

## Why 53, not 72

A `leads` row only exists when an SA logs a lead *before* a booking. When an SA creates an intro booking directly (no prior lead), the credit lives on `intros_booked.booked_by`, not on `leads.sourced_by_sa`. The auto-link trigger only fires when phone matches an existing lead.

DB right now:

- `leads` with `sourced_by_sa` set (real SA): **53**
- `intros_booked` with `booked_by` set (real SA, not deleted): **641** all-time

So the 72 you remember likely includes SA-booked intros that never had a separate lead row.

## Decision needed (one question, embedded in this plan)

Pick the definition of "self-generated" the dialog uses. The plan below assumes **(B)** since it matches your "should be 72" expectation.

- **(A) Leads-only (current):** 53 all-time. Narrow. Misses SA-booked-direct intros.
- **(B) Union — leads + SA-booked intros (recommended):** every record where an SA was responsible for generating the business, deduped by phone (lead wins if both exist, so booked status carries over). This is the count that aligns with how SAs actually work.

If you want (A), the rest of the plan still applies — just smaller numbers.

## UI changes (SourcedLeadsDialog)

**Controls row** (next to SA/All-leads toggle): a small "Status" segmented control:

- **Needs Mindbody import** (default) — hides rows that are already booked OR already marked imported
- **Already in Mindbody** — only booked or marked-imported
- **All** — everything

Total tile reflects the active filter. Grouped-by-SA counts and CSV export both respect it.

**Per-lead checkbox** on the left of every row (44px tap target):

- Checked = `mindbody_imported_at` is set
- Toggle = optimistic write to `leads.mindbody_imported_at` + `mindbody_imported_by` (current user name from `useAuth`)
- Under the name when checked: "Imported {date} by {name}"
- **Booked rows**: checkbox is auto-checked, disabled, labeled "In Mindbody (booked)" — they're implicitly already in Mindbody, no action needed

**For (B) union rows that come from `intros_booked` (no lead row):** they show booked badge + disabled checkbox same as above. No write target needed because they're already booked.

## Data changes

Add to `leads`:

- `mindbody_imported_at timestamptz`
- `mindbody_imported_by text`

No backfill — NULL means "not yet imported." No RLS change.

## Files

**New**

- `src/hooks/useMarkLeadImported.ts` — optimistic toggle, invalidates sourced-leads query key.

**Edited**

- `src/components/wig/SourcedLeadsDialog.tsx` — status filter, checkbox column, filtered total/grouped/CSV.
- `src/hooks/useSourcedLeadsInRange.ts` — select the two new columns; if (B) chosen, also fetch `intros_booked` rows with `booked_by` set in range and union them by phone.
- `src/lib/sa/sourcedLeadsCsv.ts` — add `mindbody_imported_at`, `mindbody_imported_by`, `source_type` (`'lead'` | `'booking'`) columns.
- Migration: add the two `leads` columns.

## Canonical reuse

- Booked detection: existing `booked_intro_id` (auto-set by trigger).
- Phantom-name filter: existing `PHANTOM_BOOKED_BY`.
- Current user for `mindbody_imported_by`: `useAuth().user.name` (same pattern as other write paths).
- Date range / pay period: existing helpers.

## Coherence proof (before done)

- `read_query` confirms the two new columns exist.
- Toggle checkbox → re-open dialog → state persists.
- Filter math: `Needs import + Already in Mindbody = All` for every range tested.
- Grouped-by-SA sum equals total tile for every filter.
- CSV row count matches on-screen count for the active filter.
- If (B): union de-dupe by phone — no lead appears twice; counts on the SA Leaderboard "Sourced" column still reconcile (we'll note any intentional difference).

## Out of scope

No Mindbody API integration (manual checkoff only). No changes to the SA Leaderboard counts unless (B) requires it — if so, called out explicitly with cross-page numbers in the proof.  
  
  
I want **(B) Union — leads + SA-booked intros (recommended):** every record where an SA was responsible for generating the business, deduped by phone (lead wins if both exist, so booked status carries over). This is the count that aligns with how SAs actually work.  
