## Own It — clearer Build/Flag/Offer + @mention tagging (name + role) + how-to popup

### 1. Clearer Build / Flag / Offer descriptions
Replace the tiny one-liner legend with a real explanation card at the top of Live discussion. Each row gets a colored badge, a short headline, and a sentence of plain-English description.

- **Build** (emerald) — *Add to the idea.* "Stack your thinking on top of theirs. New angle, missing context, or a way to make it stronger."
- **Flag** (red) — *Name a risk.* "Say what could go wrong, what's missing, or what concerns you. Surface it now so we can fix it."
- **Offer** (orange) — *Commit to do something.* "Volunteer a specific action you'll take to move it forward. Ends up as an Action Item with your name on it."

The same three blurbs also appear as helper text inside the response composer when an SA picks Build / Flag / Offer.

### 2. @mention tagging — by name AND by role
Tagging works inside:
- `OwnerEntryForm` — all four owner-update textareas (focus, support, blocker, ask).
- `OwnerLiveCard` response composer — Build / Flag / Offer text.
- Win logger textarea.

How it works:
- Type `@` → autocomplete dropdown that lists **two kinds of options per active person**:
  - **Name token** — `@Bri`, `@Koa`, etc. (from `staff` where `is_active = true`).
  - **Role / lane token(s)** — one entry per active lane the person currently holds in `table_owners`, e.g. `@IG Owner`, `@Retention Owner`. If a person holds two lanes, both appear.
- Each dropdown row shows: token on the left, resolved person on the right (e.g. `@IG Owner — Bri`).
- Keyboard up/down + enter to pick, click to pick.
- The token the tagger picks is **stored as-is** in the existing text columns (no schema change to entry/response/win tables). So the text in the DB might literally read `@IG Owner needs to weigh in.`

Resolution rules (used by the parser trigger and by the renderer):
- Name match → straight lookup against `staff.name` (case-insensitive, longest-first).
- Role match → lookup against `table_owners.lane_name` where `is_active = true`. The matching `display_name` becomes the tagged user.
- If two people hold the same lane historically, **only the currently active owner resolves**. Inactive owners are ignored.
- If a token matches both a staff name and a lane name, the name match wins (explicit beats implicit).
- Longest-token-first scan so `@Retention Owner` doesn't get partially matched as `@Retention`.

A shared TS helper `parseOwnItMentions(text)` lives in `src/lib/table/mentions.ts` and is used by both the renderer chip component and (mirrored in SQL) the trigger.

### 3. Notifications when you're tagged, seen, and responded-to
New table `table_mentions` is the source of truth so we can independently track "seen" and "responded" without duplicating notification rows.

```
table_mentions
  id, meeting_id, source_type ('entry'|'response'|'win'),
  source_id (uuid of the entry/response/win),
  source_owner_id (the lane that produced the text, when applicable),
  tagged_user_name text,        -- resolved person
  tagger_user_name text,        -- person who wrote the text
  raw_token text,               -- exactly what the tagger typed: '@Bri' or '@IG Owner'
  matched_lane text,            -- nullable: the lane name when token was a role
  excerpt text,                 -- first ~140 chars of surrounding text
  acknowledged_at timestamptz,
  responded_at timestamptz,
  created_by, created_at
```

Triggers (on insert/update of `table_owner_entries`, `table_responses`, `table_wins`):
- Run the same parsing rules as the client. For each match, upsert a `table_mentions` row keyed by (source_type, source_id, tagged_user_name).
- On insert, also write a `notifications` row (`notification_type = 'own_it_mention'`, `target_user = tagged_user_name`).
  - **Body format** depends on the token:
    - Name tag → `"<tagger>: <excerpt>"`
    - Role tag → `"@<lane> (<tagged_name>) — <excerpt>"` so the tagged person knows which hat they were addressed in.
- When a `table_responses` row is added under an owner whose entry mentioned someone, stamp `responded_at` on the matching mentions and write a `notifications` row back to the original tagger (`own_it_mention_responded`) with the responder's Build/Flag/Offer type.
- When the tagged user acknowledges, stamp `acknowledged_at` and write a `notifications` row back to the tagger (`own_it_mention_seen`).

Surfaces (all read from `table_mentions where tagged_user_name = me and acknowledged_at is null`):
- **Top of Own It page** — orange banner: "You're tagged in N items — review and check off." Expands to a list with Go-to-item + Mark-as-seen.
- **My Day** — "You're tagged" card above Today's Actions.
- **Coach View** — same card pinned above the coach's intro list.
- All three use the same hook `useMyOwnItMentions()` with realtime on `table_mentions`, so counts agree everywhere and Mark-as-seen clears it instantly across pages.

### 4. Replace the login welcome tooltip with a how-to popup
After successful sign-in, a one-time modal walks through:
1. My Day is your shift home base.
2. Own It is the weekly accountability table.
3. Tag teammates with `@Name` *or* `@Lane Owner` (e.g. `@IG Owner`) to ask for something — they'll be notified.
4. The bell shows mentions, replies, and "they saw it" notifications.
5. "Got it" button.

Seen state stored **client-side only** under `localStorage` key `own_it_how_to_seen_v1`. If a user clears localStorage and the popup reappears, that's acceptable — it's a one-time orientation modal, not worth a DB row. Existing welcome tooltip is removed.

### Files to change
- `supabase/migrations` — `table_mentions` table + RLS + triggers on `table_owner_entries`, `table_responses`, `table_wins`. Trigger uses a PL/pgSQL helper that scans for `@token`s, tries `staff.name` first then `table_owners.lane_name where is_active`.
- `src/lib/table/mentions.ts` — `parseOwnItMentions(text, { staff, owners })` returning `[{ raw, resolvedName, lane | null }]`. Single source of truth for client rendering and autocomplete.
- `src/components/shared/MentionInput.tsx` — wrapper over `Textarea` with `@` autocomplete listing name + lane options.
- `src/components/shared/MentionText.tsx` — renders text with tokens as colored chips (`@IG Owner` chip shows tooltip "Bri").
- `src/hooks/useMyOwnItMentions.ts` — fetch + realtime + acknowledge.
- `src/pages/TheTable.tsx` — swap legend for the descriptive Build/Flag/Offer card; mount mentions banner; swap textareas for `MentionInput`; render `MentionText` in `PeerEntry` and the response feed.
- `src/features/myDay/MyDayPage.tsx` — mount "You're tagged" card.
- `src/pages/CoachView.tsx` — mount "You're tagged" card.
- `src/components/HowToDialog.tsx` — one-time how-to modal, gated on `localStorage` only.
- `src/pages/Login.tsx` (or `AppLayout.tsx`) — trigger `HowToDialog` after first successful sign-in; remove the existing welcome tooltip.

### Verification
- Type `@` in any Own It textbox → dropdown shows both `@Bri` and `@IG Owner — Bri`. Picking either inserts that exact token.
- Tag with `@IG Owner` → Bri's bell notification reads `"@IG Owner (Bri) — <excerpt>"`. Tag with `@Bri` → reads `"<tagger>: <excerpt>"`.
- If Bri holds two lanes, `@Retention Owner` resolves to Bri specifically and notifies only her.
- If a lane has a historical inactive owner and a current active owner, role tag resolves to the active owner only.
- Bri taps "Mark as seen" → all three surfaces clear instantly via realtime; tagger gets "Bri saw your tag" notification.
- A teammate posts Build/Flag/Offer on the entry that mentioned Bri → tagger gets a "Bri responded with a Build" notification.
- Build/Flag/Offer card now shows full descriptions; same blurbs appear inline in the composer.
- Fresh login → how-to popup appears once, never again unless localStorage is cleared. No DB write happens for "seen".
- All counts agree across My Day, Coach View, and Own It (single hook, single query).