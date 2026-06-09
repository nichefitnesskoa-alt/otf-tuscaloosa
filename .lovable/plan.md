
# Text Your Sourced Leads — My Day card + Follow-Up entry

Right now when an SA logs a lead through "Log a lead you sourced," the row lives in `leads` but has no surface that nudges anyone to text them. They appear in the WIG drilldown as "not booked yet" and that's it. This adds two coordinated surfaces so leads actually get worked.

## What changes (user-visible)

**My Day — new card "Text your sourced leads"** (between the existing self-source entry card and Today's Actions)
- Shows every self-sourced lead where `booked_intro_id IS NULL` and not booked/not marked dead.
- Sorted: **mine first** (current SA = `sourced_by_sa`), then everyone else's, oldest at the top of each group so cold ones bubble up.
- Each row: name, phone (tap-to-call), source, "logged by Kaiya · 3 days ago", days-since pill that turns amber at 3 days and red at 7+.
- Right side: one orange **Text** button → opens existing `ScriptSendDrawer` pre-loaded with a new "First reach-out (self-sourced)" template, member name + phone pre-filled. Auto-log via existing `auto-log on copy` rule.
- Secondary actions in a small kebab: **Booked it** (opens BookIntroDialog with this lead) · **Not interested** (soft-archive, see below).
- Collapsed by default with a count badge; remembers open state per session.

**Follow-Up page — new bucket "Sourced — needs first text"**
- Sits at the top of the SA tab list (above No Show 1st).
- Same list as the My Day card, same row layout, same 3-button action set so muscle memory transfers.
- Drives a count chip in the existing Follow-Up tab pill so it's discoverable.

**ScriptSendDrawer — supports lead-only context**
- Today the drawer assumes a booking. We pass a `{ leadId, memberName, phone, source }` shape. Drawer renders the first-reach-out script, merges `{firstName}` / `{source}`, logs to `script_send_log` with `lead_id` instead of `booking_id`.

## Data model

**Existing `leads` columns we use:** `id, first_name, last_name, phone, source, sourced_by_sa, booked_intro_id, stage, created_at`.

**Add two columns to `leads` (migration):**
- `text_archived_at timestamptz null` — set when SA hits "Not interested." Excludes the row from the to-text list but keeps it counted in WIG Leads (per rule: leads count when sourced, not when worked).
- `text_archived_reason text null` — free text/enum: `'not_interested' | 'wrong_number' | 'duplicate'`.

**No new table.** Existing `auto_link_self_sourced_lead_to_booking` trigger already flips `booked_intro_id` + `stage='booked'` when a matching booking comes in, which is exactly our "drop off when booked" signal.

**Add one column to `script_send_log`:** `lead_id uuid null references leads(id)` so a lead-only send is loggable. `booking_id` stays nullable.

**Add one script template** (seed via insert): category `Self-Sourced`, name `First reach-out`, body in Koa voice — short, references how they got them.

## Selection rule (single source of truth)

New helper `src/lib/sa/sourcedLeadsToText.ts`:

```ts
isLeadAwaitingFirstText(l) =
  l.sourced_by_sa != null
  && l.booked_intro_id == null
  && l.text_archived_at == null
  && !PHANTOM_BOOKED_BY.has(l.sourced_by_sa)
```

Both the My Day card and the Follow-Up bucket import this — no chance of drift.

## Reach map (what gets touched)

- **Tables:** `leads` (read + archive update), `script_send_log` (insert with lead_id), `script_actions` (auto-log on copy).
- **Hooks:** new `useSourcedLeadsToText(currentSa)` returning `{ mine, others, total }`. Subscribes to `leads` realtime + listens for `DATA_CHANGED_EVENT` scopes `['leads','sa-leads']`.
- **Components:** new `SourcedLeadsToTextCard` (My Day) + `SourcedLeadsToTextTab` (Follow-Up). Both use a shared `SourcedLeadRow`.
- **Existing surfaces verified unchanged:** WIG SA leaderboard Leads column (still counts every sourced lead — archive doesn't decrement), `useSaLeads` drilldown ("not booked yet" still shows), `BookIntroDialog` link flow (already works through the phone-match trigger).
- **Realtime:** subscribe to `leads` so when one SA archives or books, the others' cards refresh.

## Out of scope (confirming)

- No outbound SMS sending — "Text" opens the script drawer; SA copies + sends from their phone.
- No automatic cold/archive after N days — leads stay until booked or marked dead (per your answer).
- No change to WIG Leads count math.
- No change to existing "Log a lead you sourced" entry card — only adding the downstream surface.

## Build order

1. Migration: add `leads.text_archived_at`, `text_archived_reason`, `script_send_log.lead_id`. Seed the new script template.
2. Helper + hook (`sourcedLeadsToText.ts`, `useSourcedLeadsToText.ts`).
3. Shared `SourcedLeadRow` component (name, phone, age pill, Text + kebab).
4. `SourcedLeadsToTextCard` on My Day; mount above Today's Actions.
5. `SourcedLeadsToTextTab` inside Follow-Up list; wire count into tab pill.
6. Extend `ScriptSendDrawer` to accept lead-only context; log to `script_send_log` with `lead_id`.
7. Coherence proof: query `leads` for unbooked sourced rows, verify both surfaces show the same list and same counts, verify booking a matching phone removes the row from both within one realtime tick.
