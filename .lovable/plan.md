## Goal

Make "Ask for a referral" something SAs actually act on inside their daily workflow (MyDay), and leave WIG with the at-a-glance accountability stats only.

## What changes

### 1. New card on MyDay — `ReferralAskActions`
- Lives in `src/features/myDay/ReferralAskActions.tsx`, rendered inside MyDay (under `TodaysActions`, above `ClassMilestoneChecks`).
- Pulls the same data the WIG tracker uses today: every `intros_run` SALE in the last ~14 days whose linked `intros_booked` is non-VIP, non-deleted, and `coach_referral_asked = false`.
- Sort: oldest sale first (so 24-hr SLA is obvious). Hide rows that have been asked. Optional "Show completed" toggle (off by default).
- Each row shows: member name, sold-by, sale date, urgency dot (red >24h, amber pending, gray fresh), plus four buttons (44px, full labels):
  1. **Send script** — opens `ScriptSendDrawer` with member context (name, phone, intro_owner) and the referral-ask category preselected. Auto-logs script send via existing logger (same pattern as `NewLeadsAlert`).
  2. **Copy phone** — copies the booking's `phone_number` (10-digit normalized) and toasts "Copied 205-555-1212". Disabled with tooltip if no phone on file.
  3. **Asked at POS** — sets `coach_referral_asked = true`, clears `referral_ask_followup_pending`. Reason: "POS referral ask logged on MyDay".
  4. **Reached out after** — same write, reason: "Referral asked after the fact from MyDay". If row is in `followupPending` state, collapses to a single **Done — asked them** button (mirrors current WIG behavior).
- Optimistic update + revert on error (lift the existing `updateBooking` helper into a shared hook — see refactor below).
- Realtime: relies on existing `useRealtimeMyDay` subscription to `intros_booked` so coach edits flow in live.

### 2. WIG `ReferralAskTracker` becomes stats-only
- Strip the per-row action buttons (Asked at POS / Reached out after / Done) from `src/components/dashboard/ReferralAskTracker.tsx`.
- Keep:
  - Header + goal copy
  - "X to do · Y asked" pills with drill-downs
  - Per-SA completion rate (already in `Wig.tsx` SA Lead Measures table — unchanged)
  - Show-completed toggle + the read-only list of members with status badges (Asked / Pending / To do)
- Remove the now-unused `handleAskedAtPos`, `handleAskLater`, `handleDoneLater`, `updateBooking`, `savingId`, `overrides` from this component (they move to the shared hook).
- Add a small "Log asks in MyDay → Today's actions" hint line under the header so SAs know where to act.

### 3. Shared hook — single source of truth
- Extract the data + mutation logic into `src/features/referralAsk/useReferralAskQueue.ts`:
  - Returns `{ rows, pendingCount, completedCount, isLoading, markAsked, markFollowupPending }`.
  - Both MyDay's new card and WIG's stats card consume it. Guarantees the numbers on both pages always match.
- Pulls phone from `intros_booked.phone_number` (already on the row) so MyDay's copy button doesn't need an extra fetch.

### 4. Coherence checks before "done"
- Pending count shown on MyDay = pending count shown on WIG (same hook).
- Marking "Asked at POS" on MyDay → WIG row flips to Asked instantly via realtime.
- Per-SA WIG leaderboard `referralAsks` still increments (writes to the same `coach_referral_asked` column the leaderboard already counts).
- VIP sales remain excluded everywhere (single filter inside the hook).

## Files touched
- New: `src/features/referralAsk/useReferralAskQueue.ts`
- New: `src/features/myDay/ReferralAskActions.tsx`
- Edit: `src/features/myDay/MyDayPage.tsx` (mount the new card)
- Edit: `src/components/dashboard/ReferralAskTracker.tsx` (strip actions, use shared hook)

## Open question (1)
Phone field on `intros_booked` — confirm the column name is `phone_number`. If the booking row doesn't carry phone, I'll join `leads` by `lead_id` inside the hook. Either way the Copy phone button only appears when a phone exists.