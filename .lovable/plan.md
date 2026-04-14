

## Plan: Fix Lead Visibility After Script Send + Sort Newest First + Real-Time Booking Filtering

Three problems to fix:

---

### Problem 1 — Script auto-close removes lead before phone can be copied

**Root cause**: `ScriptSendDrawer` auto-closes 2 seconds after copy (lines 132-135). The `script_send_log` insert also triggers realtime listeners in `NewLeadsAlert` that immediately remove the lead from the list (lines 110-119). Result: lead vanishes, SA can't copy the phone number.

**Fix in `src/components/scripts/ScriptSendDrawer.tsx`**:
- Remove the auto-close `setTimeout`. Instead, show a persistent "Copied + Logged" success state on the button but keep the drawer open.
- Add a visible "Done" button at the top of the drawer after a script is copied, so the SA can close manually after also copying the phone.

**Fix in `src/features/myDay/NewLeadsAlert.tsx`**:
- Stop removing leads from the list on `script_send_log` INSERT. The lead was contacted, not booked — it should stay visible until the SA explicitly marks it "Contacted" or it gets booked. Remove the realtime channel listener for `script_send_log` (lines 110-114). Keep the `lead_activities` listener since that represents intentional stage changes.

### Problem 2 — New leads sorted oldest-first

**Fix in `src/features/myDay/MyDayNewLeadsTab.tsx`**:
- Line 595: Change `a.created_at.localeCompare(b.created_at)` to `b.created_at.localeCompare(a.created_at)` so newest leads appear first.

### Problem 3 — Leads with booked intros not filtered in real-time

**Current state**: `MyDayNewLeadsTab` already has a realtime channel on `intros_booked` INSERT that triggers background dedup (lines 469-476). However, `NewLeadsAlert` only does a name-match check on initial fetch, not in real-time.

**Fix in `src/features/myDay/NewLeadsAlert.tsx`**:
- Add a realtime subscription on `intros_booked` INSERT. When a new booking is created, check if any current lead's name matches `member_name` — if so, remove it from the list immediately.

---

### Files Changed
1. `src/components/scripts/ScriptSendDrawer.tsx` — remove auto-close timer, add manual "Done" button
2. `src/features/myDay/NewLeadsAlert.tsx` — remove script_send_log realtime removal, add intros_booked realtime filtering
3. `src/features/myDay/MyDayNewLeadsTab.tsx` — fix sort order to newest-first

