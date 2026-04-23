

## Goal

Auto-detect and assign the correct `vip_session_id` for VIP-source intro bookings that aren't currently linked to a session — so cards like Huntley Marshall's automatically show which VIP class she came from, even if the booking was created outside the VIP outcome drawer.

## Root cause

`detectVipSessionForBooking` already exists (registration match → date proximity → most-recent), but it only fires when the SA manually changes the lead source inline on `IntroCard.tsx`. Any booking saved from any other path (Pipeline, Book Intro sheet, sheet import, Mindbody re-entry, manual entry) with a VIP-related source but no `vip_session_id` stays unlinked forever. Huntley's booking falls in this bucket.

## Changes

### 1) New shared backfill helper — `src/lib/vip/backfillVipSessionLinks.ts`

A single async function that:

- Queries `intros_booked` for rows where:
  - `deleted_at IS NULL`
  - `vip_session_id IS NULL`
  - `lead_source` matches VIP (`'VIP Class'`, `'VIP Class (Friend)'`, or any source starting with `vip class`)
  - Optional `sinceDays` window (default 60) so we don't scan years of history.
- For each row, calls existing `detectVipSessionForBooking` with `member_name`, `phone`, `email`, `class_date`, `vip_class_name`.
- **Only writes** when `autoSave === true` (Tier 1 = registration name/phone/email match). This is the safe tier — no guesses get persisted.
- Updates `intros_booked.vip_session_id` and stamps `last_edited_by = 'auto-vip-detect'`, `last_edited_at = now()` so the audit trail is clear.
- Runs in batches of 25 with small awaits to avoid hammering the DB.
- Returns `{ scanned, linked, suggestionsOnly }` for logging.

### 2) Fire the backfill automatically on My Day mount

In `src/features/myDay/useUpcomingIntrosData.ts`, after the initial fetch completes, kick off `backfillVipSessionLinks({ sinceDays: 60 })` in the background (not awaited, no UI block). On completion, if `linked > 0`, trigger a silent refresh so newly linked sessions appear on cards immediately. This covers ongoing daily use — every time an SA opens My Day, recent VIP-source bookings get auto-linked behind the scenes.

Guard with a session-scoped flag (`window.__vipBackfillRanThisSession`) so it runs once per page load, not on every refresh.

### 3) Inline auto-detect on card render (catch-up safety net)

In `src/components/shared/IntroCard.tsx`, when the card renders with a VIP-source `leadSource` AND no `vipSessionId` AND `editable && bookingId`, call `detectVipSessionForBooking` once on mount. If `autoSave: true`, persist silently and call `onFieldSaved`. If suggestion only (Tiers 2/3), do nothing (current picker UI already lets the SA confirm a suggestion).

This guarantees that any VIP-source card the SA actually views gets a chance to link itself, even outside My Day.

### 4) Admin one-click "Re-link VIP sessions" button

In `src/components/admin/VipClassPerformanceTable.tsx` header (Admin only), add a small "Re-link unlinked VIP intros" button that calls the same `backfillVipSessionLinks` helper with `sinceDays: 365` and toasts the result (`"Linked 4 of 17 unlinked VIP intros"`). This gives Koa a manual lever to clean up historical data without writing migrations.

### 5) Booking creation path safety net

In `src/components/dashboard/BookIntroSheet.tsx`, in the insert payload (around line 240), if `leadSource` is VIP-related and `vipSessionId` is empty, run `detectVipSessionForBooking` once before insert and use the result if `autoSave: true`. Prevents new bookings from being saved unlinked when an obvious registration match exists.

## Files touched

- New: `src/lib/vip/backfillVipSessionLinks.ts`
- Modified: `src/features/myDay/useUpcomingIntrosData.ts` — fire backfill once per session after first fetch
- Modified: `src/components/shared/IntroCard.tsx` — on-mount detect for unlinked VIP cards
- Modified: `src/components/admin/VipClassPerformanceTable.tsx` — admin "Re-link" button
- Modified: `src/components/dashboard/BookIntroSheet.tsx` — pre-insert detect when VIP source + empty session

No DB schema changes. No new tables. No RLS changes. No migrations.

## Safety rails

- **Only Tier 1 (registration match) writes are persisted automatically.** Tiers 2 and 3 (date proximity, most-recent) never write — they only feed the existing suggestion UI. So we cannot mis-attribute someone to a class they never registered for.
- All writes stamped with `last_edited_by = 'auto-vip-detect'` so any wrong link is identifiable and reversible.
- Existing manual `vip_session_id` values are never overwritten — the backfill query filters to `vip_session_id IS NULL` only.
- Friend bookings (`VIP Class (Friend)`) follow the same rule — they only auto-link if the friend's own name/phone/email matches a registration row, so unrelated friends aren't lumped into the wrong class.
- Central Time conventions preserved (queries use `class_date` strings, no UTC arithmetic).

## Downstream effects

- Huntley Marshall and any similar unlinked VIP intros automatically gain their `vip_session_id` on next My Day load (assuming a registration row exists for her).
- VIP attribution, performance tables (`VipClassPerformanceTable`), and conversion math immediately benefit — no extra data entry from staff.
- VIP isolation rules unchanged. Conversion math unchanged. Friend logic unchanged. Questionnaire flow unchanged.
- Role permissions unchanged (admin button is admin-only; backfill helper itself is SA-safe to call since it only reads + writes the linked field).
- Realtime subscriptions on `intros_booked` will broadcast the auto-link update to other open sessions immediately.

