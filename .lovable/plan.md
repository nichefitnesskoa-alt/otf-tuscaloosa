No shows are people who didn't show up at all (result_canon = 'NO_SHOW')   
"Missed guests" is our term for people who didn't buy a membership that showed up. They belong in the Follow Up internal tab. They are one in the same to us at OTF  
but if that missed guest has a 2nd intro booked they should not be in that category just yet.   
  
Make those edits  to the plan  
  
Plan: Filter VIP from Follow-Up System + Split No-Show vs Missed Guest

### Problem 1: VIP people appearing in follow-up queues

`useFollowUpData.ts` fetches from `intros_booked` and `intros_run` with zero VIP/COMP filtering. Every VIP class attendee leaks into No-Show, Follow-Up Needed, and other tabs.

### Problem 2: No-Show ≠ Missed Guest

Currently the "No-Show" tab lumps together:

- **No-shows**: people who didn't show up at all (result_canon = 'NO_SHOW')
- **Missed guests**: past bookings with no run record (they came but nobody logged an outcome, OR genuinely no-showed but weren't marked)

These are different situations requiring different actions. The current badge even says "Missed Guest" for everything.

---

### Changes

**1. `src/features/followUp/useFollowUpData.ts**`

- Add `booking_type_canon, is_vip` to the bookings select clause
- Add `.not('booking_type_canon', 'in', '("VIP","COMP")')` to the bookings query
- Add a new `missedGuest` state array
- In the runs loop: `NO_SHOW` result → noShow array (actual no-shows, confirmed by a run)
- In the "past bookings with no run" loop (line 208-240): these become **missed guests** (showed up but no outcome logged, or genuinely unresolved) → move to `missedGuest` array instead of `noShow`
- Also add `is_vip` check: skip any booking where `is_vip === true` or `booking_type_canon` is VIP/COMP
- Export `missedGuest` array and add `missedGuest` count to `counts`

**2. `src/features/followUp/MissedGuestTab.tsx**` (new file)

- Copy structure from `NoShowTab.tsx`
- Badge: "👻 Missed Guest" (no outcome logged)
- Actions: [Send Text] [Log Outcome]
- "Log Outcome" dispatches event to open outcome editor for that booking

**3. `src/features/followUp/NoShowTab.tsx**`

- Update badge to show "🚫 No-Show" instead of "👻 Missed Guest"
- These are confirmed no-shows (have a run with NO_SHOW result)

**4. `src/features/followUp/FollowUpTabs.tsx**`

- Add 5th tab: "Missed Guest" between No-Show and Follow-Up
- Import and render `MissedGuestTab`
- Update grid from `grid-cols-4` to `grid-cols-5`
- Add `missedGuest` count badge

**5. `src/components/leads/FollowUpQueue.tsx**` (script-based follow-up queue)

- This is a separate component but also lacks VIP filtering on its bookings query
- Add `.not('booking_status', 'eq', 'Cancelled')` check already exists, but add VIP exclusion: skip bookings where the linked booking is VIP/COMP