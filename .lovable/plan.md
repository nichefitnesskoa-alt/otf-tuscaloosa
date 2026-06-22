## Goal

Three changes to the public Giveaway feature:

1. A partner business can offer **multiple prizes** (each is its own winner slot in the draw)
2. Admin can set the giveaway to end at **end of the current month**, not just 7/10/14 days
3. Participants must enter their **Instagram handle** to submit the form

---

## 1. Multiple prizes per partner

### DB
Add to `giveaway_partners`:
- `prize_count int not null default 1` (1–10)

OTF (the studio itself) stays at 1 membership prize. Only partner businesses get a count.

### Admin UI (`SettingsPanel.tsx` → PartnersSection partner form)
- Add "How many winners for this prize?" number stepper (1–10) under "Prize for this partner"
- Edit row badge becomes `PRIZE: $175 GIFT CARD × 3` when count > 1

### Draw logic (`DrawWinner.tsx` + `winnerStructure.ts`)
- When building the `prizes[]` array, expand each partner into `prize_count` Prize entries, e.g. `Hemline #1`, `Hemline #2`, `Hemline #3`. Each is drawn independently following the existing winner-structure rules (single / no-repeat / repeat-allowed).
- "Single" structure is unchanged (still one grand winner — partner count ignored there since one person wins everything).

### Display (`PrizeShowcase.tsx`, entry form "WHAT YOU COULD WIN")
- Render one card per prize slot. Card shows partner + prize, and a small `1 of 3 winners` line when `prize_count > 1`.
- Total winners line under the grid recomputes from the new count.

### CSV export
- Winners CSV already keys off prize slot, just needs the expanded prize list passed through.

---

## 2. End-of-month countdown option

### DB
Add to `giveaway_studios`:
- `countdown_mode text not null default 'fixed_days'` — values: `fixed_days`, `end_of_month`
- `countdown_duration_days` stays (used only when mode = fixed_days)

When mode = `end_of_month`, `endAt` is computed as the last second of the current month in America/Chicago at the time `goes_live_at` was set (i.e. end-of-month *of the month the giveaway went live*).

### Admin UI (Countdown card)
Replace the 3 chips with two rows:
- Mode toggle: `Fixed duration` | `End of month`
- When Fixed: existing 7 / 10 / 14 chips
- When End of month: read-only line showing computed end date (e.g. `Ends June 30, 2026 at 11:59 PM CT`)

### Runtime (`GiveawayEntryForm.tsx`, `GiveawayPreviewPage`, `Countdown` consumers)
Extract a single helper `getGiveawayEndAt(studio)` in `src/features/giveaway/lib/endAt.ts` and route every existing `liveAt + duration*86400*1000` calculation through it. This is the canonical helper — no inline math anywhere else.

---

## 3. Required Instagram handle on entry form

### DB
Add to `giveaway_entries`:
- `instagram_handle text` (nullable in schema for back-compat; required at app layer)

Normalize on insert: strip leading `@`, lowercase, max 30 chars.

### Entry form (`GiveawayEntryForm.tsx`)
- New required field "Instagram handle" with `@` prefix adornment, placed between Phone and the IG follow section
- Add to `FormState`, `baseEmpty`, `fieldsValid` check, and the insert payload
- Validation: required, 1–30 chars, only `a-z 0-9 . _`

### Admin table (`EntriesTable.tsx`) + CSV export
- Add `@handle` column next to Phone
- Include in CSV download

---

## Out of scope
- No change to entry-counting logic (entries-per-action stays the same)
- No change to wheel weighting algorithm
- No retroactive IG handles for existing entries (column nullable, old rows stay blank)
- No change to internal app, only the public Giveaway feature

---

## Coherence proof to produce at done
- DB: query `giveaway_partners` showing new `prize_count` column populated and a 2-prize partner expanding to 2 rows in the admin entries draw list
- DB: query `giveaway_studios` showing `countdown_mode='end_of_month'` and verify the entry form, preview page, and admin "ends at" line all show the same end timestamp
- DB: query `giveaway_entries` showing `instagram_handle` populated for a new submission, and confirm the form blocks submission when blank
- Cross-page: prize count badge in Settings matches PrizeShowcase card count matches DrawWinner prize slot count
