## Goal

Treat VIP registrants like New Leads — staff see the registrant's name on the front of MyDay the moment they register, and can copy their phone or send a booking-confirmation script with one tap, both from the **VIP Updates banner** and from the **VIP Registrations sheet**.

## Root cause

Three gaps today:
1. `VipClaimBanner` only shows aggregate copy (`"15 registered for X on Mon Apr 28..."`) because the original notification was privacy-stripped — no name, no phone in `meta`.
2. The registrant rows inside `VipRegistrationsSheet` have only an outcome dropdown — no Copy Phone, no Send Script. SAs can't text the booking confirmation without leaving the sheet.
3. The VIP Updates banner has zero action buttons — only Dismiss.

The fix is a single coherent loop: write the data on registration → display + actionize it everywhere it surfaces.

## Changes

### A. `src/pages/VipMemberRegister.tsx` — write name + phone into the notification

Replace the current `notifications.insert` (privacy-stripped) with one that puts the registrant's name in the title and includes `first_name`, `last_name`, `phone`, `session_date`, `session_time` in `meta` so consumers can render actions.

- New `title`: `"{First Last} — {GroupName}"`
- New `body`: `"Just registered for {Group} on {Date} at {Time}. Text them to confirm. ({count} total registered)"`
- `meta` adds: `first_name`, `last_name`, `phone`, `session_date`, `session_time` (existing keys preserved)

This is staff-facing only (notifications already require login to view). No PII leaves the staff app.

### B. `src/features/myDay/VipClaimBanner.tsx` — add actions for `vip_member_registered`

For each notification card, when `notification_type === 'vip_member_registered'` and `meta.phone` is present:

- Render a row of two buttons under the body text, matching the New Leads alert pattern:
  - **Copy Phone** — `navigator.clipboard.writeText(meta.phone)` → 2-second `Copied!` confirmation, never collapses card.
  - **Send Script** — opens `ScriptSendDrawer` with `categoryFilter="booking_confirmation"`, `leadName={meta.first_name} {meta.last_name}`, `leadPhone={meta.phone}`, `bookingId={null}`, `leadId={null}`, `saName={user.name}`.
- Pass `user.name` from `useAuth()` (already used elsewhere in MyDay) — banner now reads it on mount.
- `vip_slot_claimed` notifications keep current behavior (no actions, no phone available).
- Dismiss button stays where it is, top-right.

44px tap targets, OTF orange CTA on Send Script, outline on Copy Phone, Lucide `Phone`/`Copy`/`Send` icons with full text labels.

### C. `src/features/myDay/VipRegistrationsSheet.tsx` — per-row Copy Phone + Send Script

In the per-attendee list (lines 219–248), each row currently shows `name + outcome dropdown`. Add two compact icon-buttons between name and outcome dropdown:

- **Copy Phone** (icon `Copy` + "Copy") — disabled if `r.phone` is null. Shows `Copied!` for 2s.
- **Send Script** (icon `Send` + "Script") — opens shared `ScriptSendDrawer` instance with:
  - `categoryFilter="booking_confirmation"`
  - `leadName="{r.first_name} {r.last_name}"`
  - `leadPhone={r.phone}`
  - `saName={userName}` (already a prop)
- Drawer state held at sheet level (single instance, opened with the active row's data) so it doesn't fight with the existing `BookIntroSheet` instance.
- Outcome dropdown stays exactly where it is on the right.

Row layout on mobile/tablet: name (truncate) · [Copy] [Script] · [Outcome ▾]. Row may wrap actions to a second sub-row under 380px width using existing flex-wrap pattern.

## Files touched

- Modified: `src/pages/VipMemberRegister.tsx` — restore name in notification title + add phone/name/session fields to `meta`.
- Modified: `src/features/myDay/VipClaimBanner.tsx` — wire `useAuth`, render Copy Phone + Send Script for `vip_member_registered`, mount one shared `ScriptSendDrawer`.
- Modified: `src/features/myDay/VipRegistrationsSheet.tsx` — add Copy Phone + Send Script buttons to each registrant row, mount one shared `ScriptSendDrawer`.

No DB schema changes. No migration. No new outcome values. No new categories — `booking_confirmation` already exists per `normalizeCategory.ts`.

## What does NOT change

- Outcome dropdown options, save logic, optimistic updates, BookIntroSheet hand-off — unchanged
- VIP isolation (`is_vip` stays false on registrant intros), conversion math, friend logic — unchanged
- `vip_slot_claimed` notifications (still aggregate, no PII to display) — unchanged
- Notifications table schema, RLS, realtime subscription — unchanged
- The two-line outcome summary just shipped (`13 showed · 2 no-show / Of those 13 → 4 booked an intro`) — unchanged
- Coach picker, attribution rules, Central Time conventions, role permissions — unchanged
- New Leads alert behavior — unchanged (this build mirrors its pattern, doesn't modify it)

## Downstream effects implemented in this build

- VIP Updates banner now shows the registrant's name on the face of MyDay as soon as they register, with one-tap Copy Phone + Send Script — matching the New Leads alert workflow exactly.
- Inside the VIP Registrations sheet, every registrant row gets the same two actions, so SAs can text confirmations after the fact without leaving the sheet.
- `script_send_log` and `script_actions` rows are auto-written by `ScriptSendDrawer.handleCopy` (existing behavior) — these VIP-confirmation sends now show up in the Activity Log, Per-SA touch counts, and shift recap automatically.
- The new `meta.phone` payload is consumed only by the banner today; future surfaces (e.g. shift recap, manager Slack-style digests) can read it without a follow-up migration.
- Existing notifications inserted before this build still render — the banner gracefully omits action buttons when `meta.phone` is missing.
- No new role visibility added: only SAs/Coaches/Admins who already see MyDay see VIP Updates; behavior unchanged.
