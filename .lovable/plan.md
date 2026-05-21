# OTF Giveaway System — Build Plan

Two-sided giveaway: gamified public entry forms (one per studio) and admin panels for management + winner draws. All data in existing Supabase.

## 1. Database (single migration)

**Tables**
- `giveaway_studios` — `studio_slug` (unique), `studio_name`, `partner_name`, `partner_instructions`, `countdown_duration_days`, `goes_live_at`, timestamps
- `giveaway_entries` — identity fields, `base_entries` (default 1), `bonus_entries`, `total_entries` (generated stored column), 5 action booleans + 4 screenshot URL columns, `submitted_at`. Unique on `(studio_slug, email)` (case-insensitive via expression index on `lower(email)`)
- `giveaway_uploads` — `entry_id` FK, `action_type`, `file_url`

**Seed**: 4 rows in `giveaway_studios` — tuscaloosa, auburn, montgomery, vestavia. `goes_live_at = null`.

**Storage**: `giveaway-uploads` bucket, public read.

**RLS**
- `giveaway_entries`: public INSERT, public SELECT (admin is URL-gated per spec)
- `giveaway_uploads`: public INSERT + SELECT
- `giveaway_studios`: public SELECT; UPDATE allowed (admin URL-gated)
- Storage policies: public INSERT + SELECT on `giveaway-uploads`

## 2. Routes (added to `src/App.tsx`, outside the authenticated app shell)

- `/giveaway/:studioSlug` → `GiveawayEntryPage`
- `/admin/:studioSlug` → `GiveawayAdminPage`

These render standalone (no SA/Coach/Admin auth, no app nav).

## 3. File structure

```
src/features/giveaway/
  GiveawayEntryPage.tsx          — route component, state machine (coming soon / countdown / live / ended)
  GiveawayAdminPage.tsx          — route component, sidebar layout
  components/
    Countdown.tsx                — D/H/M/S, recalculates each second
    EntryForm.tsx                — name/email/phone inputs
    AchievementCard.tsx          — single action card (lock → unlock animation)
    ScreenshotUpload.tsx         — drag/tap upload to Storage, thumbnail preview
    LiveEntryCounter.tsx         — animated count-up, progress bar 1-of-6
    ConfirmationScreen.tsx       — confetti + name + entry total
    EntriesTable.tsx             — expandable rows w/ screenshot thumbs
    DrawWinner.tsx               — 3-2-1 reveal w/ confetti
    SpinWheel.tsx                — canvas-based weighted wheel, top-20 cap
    SettingsPanel.tsx            — partner fields, duration, go-live
  hooks/
    useGiveawayStudio.ts         — fetch + realtime studio row
    useGiveawayEntries.ts        — fetch entries for admin
    useEntryDraft.ts             — local form state, action completions
  lib/
    weightedDraw.ts              — build tickets array, pick winner
    csvExport.ts                 — generate + download CSV
    uploadScreenshot.ts          — Storage upload helper, returns public URL
```

## 4. Participant flow (`/giveaway/:studioSlug`)

**Gate logic** based on `goes_live_at` + `countdown_duration_days`:
- `null` → "Coming soon"
- future → countdown screen
- live window → form
- past end → "Giveaway has ended"

**Form behavior**
- Studio pre-set from route; no dropdown
- Action 1 (IG follow): checkbox → instant +1
- Actions 2–5: upload to Storage first, then award +1 on success
- Live counter: 1 base + N bonus, animated count-up + scale pulse, progress bar (max 6)
- Submit disabled until name/email/phone filled
- On submit:
  1. Query `giveaway_entries` where `studio_slug` + `lower(email)` match
  2. If exists → inline error "You've already entered at this studio."
  3. Else insert row with action booleans + URLs → confirmation screen w/ confetti + earned count

**Partner copy** (Action 5): reads `partner_name`/`partner_instructions` from studio row with the documented fallbacks.

## 5. Admin flow (`/admin/:studioSlug`)

**Sidebar**: Entries | Settings | studio name + "Admin" badge.

**Entries view**
- Header: "X total entries in pool" = sum of `total_entries`
- Table: Name | Email | Phone | Entries (bold, orange badge if >1) | Actions Completed (5 check icons) | Submitted
- Row click → expands to thumbnails of uploaded screenshots
- **Download CSV** button: includes all fields + 5 action booleans + 4 screenshot URLs
- **Draw Winner**: weighted via tickets array (name pushed `total_entries` times), 3-2-1 countdown → full-screen confetti reveal
- **Spin Wheel**: same weighted source, capped to top-20 unique entrants by entry count, alternating charcoal/orange segments, physics-based decel over 4–6s, modal reveal

**Settings view**
- Partner name (text), partner instructions (textarea)
- Duration segmented control: 7 / 10 / 14
- **GO LIVE NOW** button → sets `goes_live_at = now()`; shows end date; if already live shows "Reset / End Giveaway" → sets `null`
- Save Settings persists partner fields + duration

## 6. Design tokens

Add giveaway-scoped utilities/tokens (no clash with existing app):
- Background `#1C1C1E`, accent `#E8540A`, body `#F5F2EE`
- Display font: Bebas Neue (closest free analog of Big Shoulders, already-available pattern). Load via `<link>` in `index.html`.
- All tap targets ≥ 44px
- Animations via Framer Motion (already in repo) + a small canvas confetti util

## 7. Cross-file verification checklist (run before reporting done)

- A. All 4 studio slugs seeded
- B. Uploads land in `giveaway-uploads` before counter ticks
- C. Action 5 copy reads from DB, not hardcoded
- D. Draw + wheel weighted by `total_entries`
- E. CSV includes all action booleans + URLs
- F. Countdown ticks every 1s vs `goes_live_at + duration_days`
- G. Email uniqueness scoped to `studio_slug`
- H. 44px min tap targets verified
- I. Confirmation shows earned entry total

## Technical notes

- Generated column: `total_entries integer GENERATED ALWAYS AS (base_entries + bonus_entries) STORED`
- Case-insensitive email dedup: unique index on `(studio_slug, lower(email))` + lowercase email before insert/lookup
- Storage uploads use anon client; path scheme: `{studio_slug}/{entry_draft_id}/{action_type}-{timestamp}.{ext}`
- Public pages bypass existing auth gate by mounting routes above the `<RequireAuth>` boundary in `App.tsx`
- Realtime subscription on `giveaway_entries` for admin so new entries appear live
- Spin wheel implemented in plain `<canvas>` to avoid new deps

## Out of scope (confirm if needed)

- No email/SMS notification to winner
- No image moderation on uploads
- Admin has no auth — gated only by URL knowledge, as specified
