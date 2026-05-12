## Problem

When an SA marks a member as "Done — asked them" (or "Reach out after") on MyDay, the change saves to `intros_booked` but:

1. The WIG tab doesn't reflect the new counts/state until a hard refresh.
2. On MyDay itself, the row sometimes lingers because the optimistic override only lives inside that one hook instance.

Root cause: `useReferralAskQueue` writes to Supabase, but `DataContext` (the source of `introsBooked`/`introsRun` for both surfaces) is never told to refetch. Each component's local `overrides` state is isolated, and there is no realtime subscription on `intros_booked` for the referral-ask fields.

The MyDay filter `!r.coachReferralAsked` is already correct — once the data layer reflects `coach_referral_asked = true`, the row drops automatically. The fix is making sure the data layer actually updates everywhere.

## Plan

### 1. Trigger a shared refresh after every referral-ask mutation

In `src/features/referralAsk/useReferralAskQueue.ts`:

- Pull `refreshData` (and `silentRefreshData` if exposed) from `useData()`.
- After the Supabase update succeeds in `updateBooking`, call `silentRefreshData()` (preferred — no flicker) so `DataContext.introsBooked` re-reads the new `coach_referral_asked` / `referral_ask_followup_pending` values.
- Keep the optimistic `overrides` map for instant UI feedback; once the refetch lands with the real values the override and the source agree, so behavior stays smooth.

This single change makes both surfaces converge:
- MyDay: row drops out of `visibleRows` (filter already excludes `coachReferralAsked`).
- WIG `ReferralAskTracker`: counts and the per-member list update because they read from the same `introsBooked` slice.

### 2. Make sure WIG counts re-render even without a re-mount

`ReferralAskTracker` already calls `useReferralAskQueue` with the same data source, so a `DataContext` refetch will re-derive its memoized `rows`, `pendingCount`, and `completedCount`. No extra wiring needed once step 1 lands — verify by:
- MyDay: click "Done — asked them" on a pending row → row disappears from the list immediately, "to do" count drops by 1, "asked" count goes up by 1.
- Switch to WIG → counts and member status reflect the same change without refresh.

### 3. Belt-and-suspenders: realtime fallback

`useRealtimeMyDay` already subscribes to `intros_booked` on MyDay. Add the same subscription path for the WIG page so a second SA marking someone "asked" on another device updates the open WIG tab too. Concretely: in `src/pages/Wig.tsx`, mount `useRealtimeMyDay(refreshData)` (or a slimmer hook scoped to `intros_booked`) so any external change repaints the tracker.

### Coherence check before done

- MyDay → click Done: row disappears, counts shift, no flicker.
- WIG tab open in a second window → counts and "Asked / Follow up pending / To do" badges update within ~1s.
- "Reach out after" still leaves the row visible with the warning badge (followupPending=true, coachReferralAsked=false), and a subsequent Done removes it.
- Verify `pendingCount` on WIG equals MyDay's "to do" count for the same date range.

### Files to touch

- `src/features/referralAsk/useReferralAskQueue.ts` — call `silentRefreshData()` after successful update; revert override only on error (already does).
- `src/pages/Wig.tsx` — wire `useRealtimeMyDay(refreshData)` (or equivalent) so other-device updates land live.

No DB migration, no UI restructuring, no new components.
