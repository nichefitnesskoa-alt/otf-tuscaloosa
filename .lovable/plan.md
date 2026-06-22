# Giveaway: phone-gated entry with resume / return

Mirror the bingo flow. Today the giveaway is one shot: the public link is the partner deck, and `GiveawayEntryForm` blocks anyone whose email already exists. Replace that with a phone-first gate that lets people enter once, then return anytime before the giveaway ends to complete more actions and earn more entries.

## What changes for the participant

1. Public link (e.g. `/OTF-AUBURN-PARTNER`) still opens the partner deck.
2. The "Enter the Giveaway" CTA in the deck goes to the entry page (no change to the URL the partner sees).
3. Entry page first shows a **gate screen** — two paths:
  - **First time:** First name, Last name, Phone, Email, IG handle → "Start my entry."
  - **Coming back:** Phone only → "Resume my entry."
4. After the gate, the existing actions UI loads with their current progress. Each action saves on toggle/upload (no big Submit button required). A header shows "X entries earned · Add more to win."
5. A persistent "Save my link" button copies a personal URL (`/<shareSlug>/entry/<entry_slug>`) so they can bookmark or text it to themselves. That URL auto-resumes without re-entering phone.
6. `localStorage` remembers them on the same device so they skip the gate on return.
7. When the giveaway ends, the page flips to the existing "Giveaway has ended" screen and locks edits.

## What changes for admin

Nothing visible. The existing entries table keeps working; `total_entries` updates live as participants add actions.

## Technical details

**DB migration (`giveaway_entries`)**

- Add `phone_normalized text` (10-digit stripped) — new uniqueness key per studio.
- Add `entry_slug text` — short random token for the personal URL.
- Add unique index `(studio_slug, phone_normalized)`. Keep the existing email uniqueness or drop it (phone becomes the primary identity). Recommend: drop email uniqueness, keep phone+studio unique.
- Add unique index on `entry_slug`.
- Backfill existing rows: derive `phone_normalized` from `phone`, generate `entry_slug`.
- RLS: keep anon `INSERT`, add anon `UPDATE` scoped to rows matched by `entry_slug` (the slug acts as the bearer token, same trust model as bingo's `share_slug`). Anon `SELECT` limited to single row by `entry_slug` or `phone_normalized` exact match — never list.

**New hook `useGiveawayEntry(slug)**`
Modeled on `useBingoPlayer`:

- `entry`, `loading`, `saving`
- `startEntry({ first_name, last_name, phone, email, instagram_handle })` — insert; on phone collision, resume that row.
- `resumeByPhone(phone)` — lookup by `(studio_slug, phone_normalized)`.
- `resumeBySlug(entry_slug)` — lookup by slug (used by personal URL).
- `updateActions(patch)` — patches IG checks, post engagement, story, free class, partner actions, recomputes `bonus_entries` server-side (or client + write).
- LocalStorage key `otf_giveaway_entry_<studio_slug> = entry_id`.

**Routing**

- Keep `/<shareSlug>` → partner deck.
- New route: `/<shareSlug>/entry` → `GiveawayEntryPage` (gate + form).
- New route: `/<shareSlug>/entry/:entrySlug` → `GiveawayEntryPage` auto-resumed.
- Update existing CTAs in `PartnerDeckPage` ("Enter now" buttons) to route to `/<shareSlug>/entry`.

`**GiveawayEntryForm` refactor**

- Split into:
  - `EntryGateScreen` — two tabs (Start / Resume), validates phone, calls hook.
  - `EntryActionsScreen` — current actions UI, but each toggle/upload immediately calls `updateActions`. Remove the single Submit button; show inline "Saved" pill and a sticky "X entries · share my link" footer.
- Remove the duplicate-email error path; the gate handles identity.
- Confetti / `ConfirmationScreen` fires once on first-time entry creation, then becomes a small "Nice — you're in" banner for subsequent action saves.

**Personal URL share**

- Button copies `${window.location.origin}/<shareSlug>/entry/<entry_slug>` to clipboard, plus a "Text me my link" that opens `sms:` prefilled.

## Out of scope

- No SMS verification (matches bingo's trust model: phone = identifier, slug = bearer).
- No changes to draw/winner logic, partner CRUD, or partner deck content.
- No changes to admin entries table beyond reading the new fields.

## Coherence checks before done

- Existing entries still load in `EntriesTable`, `PartnerViewPage`, and `DrawWinner` with their `total_entries` unchanged.
- A participant who entered before the migration can resume by phone and add more actions; their `total_entries` increases and the live counter on `PartnerViewPage` matches the admin `EntriesTable` row.
- Two participants with the same phone at the same studio cannot create duplicate rows.
- Giveaway end time still blocks edits.

## Open question

Drop the existing email-uniqueness constraint, or keep both phone and email unique? Recommendation: drop email uniqueness — phone is the new identity, and forcing email uniqueness will reject legitimate spouses/roommates sharing an email.  
  
  
Drop email uniqueness and use phone as the new identity