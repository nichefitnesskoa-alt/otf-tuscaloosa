## Goal

Replace the ugly `/book?sa=Koa&source=Intro+Scheduler+Link` link with a short, professional URL like:

```
lovableproject.com/book-intro/k3
```

Where:

- `k` = SA's first initial (lowercase). Collisions get a number suffix (`k`, `k2`, `k3`…).
- `3` = a small integer code tied to the lead source they picked (1 = Intro Scheduler Link, 2 = Instagram DMs, 3 = Event, etc.).

Event-bound links become `/book-intro/k3-<eventCode>` (short event code, not a UUID) so the URL stays clean.

Friend links stay short too: `/book-intro/f/<shortCode>` where `<shortCode>` is a 6-char slug on the originator booking (not the full UUID).

## How it works

### 1. New DB table: `intro_link_codes`

Persistent lookup so the same SA + same source always resolves to the same short URL — no drift, no regeneration.

Columns:

- `code` (text, primary key) — e.g. `k3`
- `sa_name` (text)
- `source` (text) — one of the LEAD_SOURCES values
- `event_id` (uuid, nullable) — only used when source is 'Event'

RLS: public read (needed by the public `/book-intro/:code` page), authenticated insert/update, service_role all.

### 2. Short event codes

Add `short_code` (text unique, 4-char) to the existing events table. Auto-generated on insert via trigger. Used to build `k3-<short_code>` without exposing UUIDs.

### 3. Short friend codes

Add `friend_code` (text unique, 6-char) to `intros_booked` (only populated when someone taps "invite a friend"). Trigger fills it on demand. Friend URL = `/book-intro/f/<friend_code>`.

### 4. New route

- `/book-intro/:code` → resolves code → sa/source/event_id → renders the existing `BookIntro` page with those values internally.
- `/book-intro/f/:friendCode` → resolves to originator booking → friend flow.
- Keep the old `/book?...` route working as a redirect (any QR codes already printed still work).

### 5. Code generation logic (client-side in `IntroSchedulerLinkCard`)

When the SA opens the card and picks a source:

1. Compute proposed SA slug: first initial lowercased, plus `2`, `3`… if that initial is already taken by another SA in `intro_link_codes`.
2. Look up source → source number using a canonical map in `src/lib/introScheduler/sourceCodes.ts` (1–14, alphabetized to match `LEAD_SOURCES`).
3. Upsert `{code: '<saSlug><sourceNum>[-<eventShort>]', sa_name, source, event_id}` into `intro_link_codes`.
4. Show `https://<origin>/book-intro/<code>` and the QR for that URL.

Same SA + same source always returns the same code (idempotent upsert on `(sa_name, source, event_id)`).

### 6. Files touched

- new: `supabase` migration for `intro_link_codes`, `events.short_code`, `intros_booked.friend_code`, and their triggers
- new: `src/lib/introScheduler/sourceCodes.ts` (LEAD_SOURCE → number map)
- edit: `src/lib/introScheduler/linkUrl.ts` — replace query-string builders with short-code builders + resolver
- edit: `src/components/admin/IntroSchedulerLinkCard.tsx` — upsert code on source change, render short URL
- edit: `src/pages/BookIntro.tsx` — read code from route param, resolve via `intro_link_codes` / `events.short_code` / `intros_booked.friend_code`
- edit: `src/App.tsx` — add `/book-intro/:code` and `/book-intro/f/:friendCode`, keep `/book` as legacy redirect

## Coherence checks before done

- SA "Koa" + source "Intro Scheduler Link" → `/book-intro/k1` (or whatever k+source# resolves to), same code every time the card is reopened.
- Second SA with first name starting K → gets `k2…`.
- Event-tagged link shows `/book-intro/k3-a1b2`; scanning still books tagged to that event.
- Friend link is `/book-intro/f/xxxxxx` and preserves original SA + source + event.
- Old `/book?sa=...&source=...` links still resolve (printed QR codes keep working).
- Booking created via short link is attributed to correct SA + source + event, and shows up in My Day banner and follow-up queue exactly like today.

## Open question

Should I keep the old `/book?...` query-string URL working as a permanent fallback (for QRs already in the wild), or force everything through the new short URL and let old QRs 404? Default in this plan = keep it working forever as a silent redirect.

&nbsp;

keep the old /book?... query-string URL working as a permanent fallback (for QRs already in the wild)