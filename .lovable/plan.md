

## Plan: Replace "Classes Redeemed" with "Friend Showed Up" Tracking (3 Detection Methods)

The current system tracks `classesRedeemed` count which is misleading. Replace with a simple boolean: did the friend take their first class or not? Three ways to determine this.

---

### Database Change

**Migration: Add `friend_showed_up` column to `milestones`**
```sql
ALTER TABLE public.milestones 
  ADD COLUMN friend_showed_up boolean NOT NULL DEFAULT false;
```

This stores the definitive answer regardless of which detection method triggered it.

---

### Change 1 — Auto-Detection on Load

**File: `src/components/dashboard/MilestonesDeploySection.tsx`**

In `loadData()`, replace the current per-friend query loop (lines 132-160) with simpler logic:

For each milestone with `five_class_pack_gifted = true` AND `friend_name` set:
1. **Pipeline check**: Search `intros_booked` by name (case-insensitive) for any booking with `booking_status_canon = 'SHOWED'`
2. **Lead source check**: Search `leads` by name where `source = 'Member Referral (5 class pack)'`, then check if that lead's `booked_intro_id` links to a SHOWED booking
3. **Sale check**: If any linked run has `result_canon = 'SALE'`, mark `convertedToMember = true`

If any check finds a SHOWED booking AND `friend_showed_up` is currently `false` on the milestone, auto-update it to `true` in the database silently.

Replace `FriendTrackingInfo` interface:
```typescript
interface FriendTrackingInfo {
  friendShowedUp: boolean;
  convertedToMember: boolean;
}
```

Replace summary fields: remove `classesRedeemed`, add `friendsShowedUp` count.

---

### Change 2 — Manual "They Came In" Button on Each Card

**File: `src/components/dashboard/MilestonesDeploySection.tsx`**

On each celebration row where `five_class_pack_gifted = true` AND `friend_name` exists:
- If `friend_showed_up = false` (and auto-detect didn't find them): show a button **"They Came In"** that sets `friend_showed_up = true` on the milestone record
- If `friend_showed_up = true`: show a green badge **"Friend Showed Up"**
- If `convertedToMember = true`: show green badge **"Converted to Member"** (replaces "Converted")

Remove the old "X classes redeemed" badge entirely.

---

### Change 3 — Lead Source as Detection Path

Already handled in Change 1's logic. When a lead exists with source `'Member Referral (5 class pack)'` and their name matches the friend, the system checks their booking status. This is a third detection vector alongside direct name search in `intros_booked`.

---

### Summary Card Updates

Replace:
- "Classes redeemed" → **"Friends Showed Up"** (count of milestones where `friend_showed_up = true`)
- Keep "Converted to member" as-is

---

### Files Changed
1. **Database migration** — add `friend_showed_up` boolean to `milestones`
2. `src/components/dashboard/MilestonesDeploySection.tsx` — replace tracking logic, add manual button, update summary cards and badges

### No Other Downstream Effects
The `friend_showed_up` column is only read/written in this component. The `FriendTrackingInfo` interface is local. No other pages reference `classesRedeemed`.

