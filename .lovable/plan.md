

## Goal

When the user changes `lead_source` to `VIP Class` or `VIP Class (Friend)` from the **inline header dropdown** on a My Day intro card, the app should:
1. Save the lead source change.
2. Automatically try to detect which past VIP session this member came from.
3. Open an inline VIP class picker so the SA can confirm or change the detected session — choosing from any past VIP class we've ran (active + archived).
4. Save `vip_session_id` (and `vip_class_name`) onto the booking.

If a `vip_session_id` is already set, picking the lead source again should still let them open the picker to change it.

## Root cause (why this is missing today)

`IntroCard.tsx` `InlineSelect` only writes `lead_source` to `intros_booked`. It has no awareness of VIP. Every other surface that sets `lead_source = VIP Class` (BookIntroSheet, EditBookingDialog, PipelineDialogs) renders `<VipSessionPicker>` right next to the source field — the inline editor on My Day cards is the one place that skips this. So when the SA changes source to VIP inline, the booking ends up with `lead_source = VIP Class` but `vip_session_id = NULL`, which silently breaks VIP attribution and reporting.

## Changes

### 1) `src/components/shared/IntroCard.tsx`
- After the `InlineSelect` for `lead_source` saves successfully, detect if the new value is `VIP Class` or `VIP Class (Friend)`.
- If yes:
  - Auto-detect best-match VIP session for this member (logic below).
  - Open a small inline VIP picker popover anchored to the lead source chip showing:
    - **Suggested** (auto-detected match, if any) at top, pre-selected.
    - All past VIP sessions (active + archived) below, newest first — matches the existing `VipSessionPicker` behavior.
  - On confirm: write both `vip_session_id` and `vip_class_name` (derived from the chosen session's `reserved_by_group`) to `intros_booked` for this booking, plus `last_edited_at` / `last_edited_by`. Trigger `onSaved()` to refresh.
  - On dismiss without choosing: leave `vip_session_id` as-is, show a small amber "VIP class not set" hint next to the source chip until set.
- Also: if `lead_source` already starts with `VIP Class`, render a small "VIP class: <name>" link/button right after the source chip in the header. Tapping it reopens the same picker so the SA can change which past VIP class.

### 2) Auto-detect logic (new helper, e.g. `src/lib/vip/detectVipSessionForBooking.ts`)
Given the booking row (`member_name`, `phone`, `email`, `class_date`), pick the best VIP session via this priority:
1. **Exact registration match** — `vip_registrations` row whose `first_name + last_name` (case-insensitive) matches `member_name`, OR `phone` matches the booking's `phone`, OR `email` matches `email`. Return that row's `vip_session_id`.
2. **Class-date proximity** — most recent `vip_sessions` row with `session_date <= class_date` (booking date) and matching `reserved_by_group` if `vip_class_name` is already set on the booking.
3. **Most recent VIP session overall** if nothing else matches — only used as a soft suggestion, NOT auto-saved without user confirmation.

Tier 1 is the only one that auto-saves silently. Tiers 2 and 3 pre-select inside the picker but require the user to confirm.

### 3) Reuse `VipSessionPicker` look
The inline popover should reuse the same option rendering (`reserved_by_group — Mon D, YYYY at H:MM AM`, archived section grouped separately) from `src/components/shared/VipSessionPicker.tsx` so the experience matches Edit Booking / Book Intro / Pipeline. No duplicate UI.

### 4) Field writes
On confirm, single update to `intros_booked`:
- `vip_session_id` = chosen session id
- `vip_class_name` = chosen session's `reserved_by_group` (kept in sync so legacy reports still work)
- `is_vip` = `true`
- `last_edited_at` = now (Central Time as elsewhere)
- `last_edited_by` = current user

If lead source is changed away from VIP later, leave `vip_session_id` intact (matches existing behavior — no destructive cleanup).

## Files touched

- `src/components/shared/IntroCard.tsx` — add inline VIP picker trigger + popover after lead source change; render "VIP class: …" affordance when lead_source is VIP.
- `src/lib/vip/detectVipSessionForBooking.ts` — new file, auto-detect logic.
- (Reused as-is) `src/components/shared/VipSessionPicker.tsx` — same options rendering, called from the new popover.

No DB changes. No RLS changes. No changes to BookIntroSheet, EditBookingDialog, or PipelineDialogs flows.

## Downstream effects

- My Day intro cards now correctly link to a VIP session whenever lead source is set to `VIP Class` or `VIP Class (Friend)` inline — no more silently-orphaned VIP rows from inline edits.
- VIP attribution surfaces (`isVipBooking` in `src/lib/vip/vipRules.ts`, `VipClassPerformanceTable`, VIP isolation in conversion metrics, scoreboard exclusions) all start counting these bookings under their correct VIP session.
- Coach/SA can change which past VIP class a member came from at any time via the same inline header.
- Auto-detect via registration match means the most common case (member registered for a VIP, then booked) requires zero extra clicks.
- No effect on bookings where lead source isn't VIP. No retroactive change to existing bookings — auto-detect only runs when the SA actively sets the source.
- Central Time conventions preserved for `last_edited_at`.

