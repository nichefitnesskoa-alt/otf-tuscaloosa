## How players come back to their card

Today, the card only resumes via `localStorage` on the same device/browser. If they clear cookies, switch phones, or open it on a friend's device, they lose the card. We'll fix that and add sharing.

### 1. Resume by phone number (primary recovery)

On `/bingo`, when someone enters info, we already look them up by `phone_normalized` and resume their card. We'll make this explicit and friendly:

- The entry screen gets two modes: **"Start my card"** and **"I already started — find my card"**.
- "Find my card" asks for **phone number only**, normalizes to 10 digits, looks up the row, and if found: stores the id in `localStorage` and loads the card.
- If not found: gentle copy ("We don't see a card with that number — start a new one below.")
- Existing "Start" flow is unchanged — it still resumes automatically if the phone matches an existing player (no duplicates).

This means: any device, any time → type your phone → card is back. No custom slug required for the player.

### 2. Shareable read-only progress URL (for bragging to friends)

Each `bingo_players` row gets a stable `share_slug` (short, URL-safe, e.g. `sarah-3x7k`) generated on insert. We add a public route:

- `/bingo/s/:slug` → read-only card view: shows their name, bingos, raffle entries, and which squares are marked. No tap-to-toggle, no edit. Clear CTA at the bottom: "Want your own card? Start one →" linking to `/bingo`.
- On the player's own card we add a **"Share my progress"** button that copies `https://otf-tuscaloosa.lovable.app/bingo/s/<slug>` to clipboard.
- Admin board already lists players — we'll add the share link next to each row so staff can grab it too.

### 3. Why not give the player a custom slug as their primary return path?

Phone lookup is more reliable for this audience: members will forget a bookmark, but they know their phone number. The slug exists for *sharing*, not for *returning*. Best of both.

---

## Technical details

**Migration (`bingo_players`):**
- Add `share_slug text unique` (nullable for backfill, then enforced).
- Backfill existing rows with generated slugs (`lower(first_name) || '-' || substr(md5(id::text),1,4)`).
- Add index on `phone_normalized` (likely already exists from the lookup; verify).
- Update `GRANT SELECT` policy so `anon` can read `bingo_players` by `share_slug` (read-only). Current policies allow public read for the card flow already; we'll scope carefully so we don't expose `phone`/`email` on the public share view — the read-only page will select only `first_name, marked_squares, bingo_count, completed_lines, blackout_completed_at, share_slug`.

**Files to edit:**
- `supabase/migrations/<new>.sql` — add `share_slug`, backfill, unique index.
- `src/features/bingo/useBingoPlayer.ts` — add `findByPhone(phone)` method; include `share_slug` in the player interface.
- `src/features/bingo/BingoPage.tsx` — split entry gate into "Start" / "Find" tabs; add "Share my progress" button on the card.
- `src/features/bingo/BingoSharePage.tsx` — **new**, read-only card at `/bingo/s/:slug`.
- `src/App.tsx` — register `/bingo/s/:slug` route.
- `src/components/admin/BingoAdminTab.tsx` — show share link per player (optional, additive).

**No existing metrics, leads, intros, or bookings are touched.** This is isolated to `bingo_players` only.

---

## Coherence checks before done
- Insert a test player → verify `share_slug` is generated and unique.
- Open `/bingo/s/<slug>` in incognito → card renders read-only, no phone/email leaked in the network response.
- Clear `localStorage`, go to `/bingo`, click "Find my card", enter the test phone → card loads, same `id`.
- Mark a square on the owner's card → refresh the share URL → progress updates (same row, same numbers).
- Admin board entries-per-player count still matches `raffleEntriesFor(bingo_count)` for that row.