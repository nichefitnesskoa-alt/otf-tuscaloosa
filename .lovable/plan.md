

# Complete Follow-Up Tab Rebuild — Priority-Sorted Single List

## Summary
Replace the four-tab follow-up system with a single priority-sorted list, daily focus count, two collapsible sections (Focus Today / Coming Up), redesigned compact cards, and a type filter bar.

## Changes

### 1. New component: `src/features/followUp/FollowUpList.tsx`
Replaces `FollowUpTabs.tsx` as the main follow-up UI. Contains:

**Header area:**
- "Your focus today: [X] people" (bold, large) where X = items with `contactNextDate <= today`, capped at 20
- "[Total] total in queue" in muted text below
- Refresh button (same as current)

**Filter bar:** Five pills below header: `All | No-Show | Missed | 2nd Intro | Reschedule`. Orange fill when selected, muted outline when not. "All" default. Filters the visible list by `badgeType`/`resultCanon`.

**Section 1 — "Focus Today"** (expanded by default):
- All items where `contactNextDate <= today`, sorted by priority score then oldest intro first
- Capped at 20 visible. If more: "Showing 20 of [X] — complete some to see more"
- Collapsible with chevron

**Section 2 — "Coming Up"** (collapsed by default):
- All items where `contactNextDate > today`
- Header: "Coming Up — [X]" with chevron
- Same card design, same sort

### 2. Priority scoring (computed in the component from existing `FollowUpItem` data)
```
Priority 1: contactNextDate < today → "Overdue" (red pill)
Priority 2: contactNextDate === today → "Due today" (orange pill)
Priority 3: lastContactAt === null → "First touch" (amber pill)
Priority 4: lastContactAt > 7 days ago → "Follow up" (muted pill)
Priority 5: contactNextDate within this week → "Follow up" (muted pill)
Priority 6: everything else → "Follow up" (muted pill)
```
Within each level: sort by `classDate` ascending (oldest first).

### 3. Card redesign (inline in FollowUpList or a small `FollowUpCard` sub-component)
Each card is a compact bordered row:
- **Line 1:** Member name (bold) · Priority pill · Type pill (No-Show / Missed / 2nd Intro / Reschedule)
- **Line 2:** Intro date · Coach: name · Phone number
- **Line 3:** "Never contacted" or "Last contact X days ago via channel"
- **Line 4:** Contact next date with inline edit pencil (reuse `ContactNextEditor`)
- **Actions row:** Three buttons:
  - **"Send Text"** (orange filled, 44px) — dispatches `myday:open-script` with category based on type: no-show→`no_show`, missed→`follow_up`, 2nd→`feedback`, reschedule→`reschedule`
  - **Button 2** — context-dependent:
    - No-Show/Missed: "Book 2nd Intro" (outlined) — dispatches `followup:book-second-intro`
    - 2nd Intro: "Mark Sold" (outlined) — opens outcome drawer
    - Reschedule: "Book Now" (outlined) — dispatches `followup:book-second-intro`
  - **"Log as Done"** (muted text button) — logs `script_sent` to `script_actions`, advances contact_next date based on touch count (2→3→5→7 days), refreshes list

No "Dismiss" button visible — swipe-left reveal for dismiss (CSS `overflow-hidden` with a translateX gesture using touch events, revealing a red "Dismiss" panel).

### 4. Modify `useFollowUpData.ts`
- Return a single flat `allItems` array combining noShow + missedGuests + secondIntro + plansToReschedule (plus cooling items)
- Add a `followUpType` field to `FollowUpItem`: `'noshow' | 'missed' | 'secondintro' | 'reschedule'` — set during the existing categorization logic
- Keep `counts.total` for the badge
- Keep `refresh` function

### 5. Update `MyDayPage.tsx`
- Replace `<FollowUpTabs>` import with `<FollowUpList>`
- Pass same props (`onCountChange`, `onRefresh`)

## Files Modified
1. `src/features/followUp/useFollowUpData.ts` — add `followUpType` to items, expose flat `allItems` array
2. `src/features/followUp/FollowUpList.tsx` — new component (replaces FollowUpTabs)
3. `src/features/myDay/MyDayPage.tsx` — swap FollowUpTabs → FollowUpList
4. Old tab files (`NoShowTab.tsx`, `FollowUpNeededTab.tsx`, `SecondIntroTab.tsx`, `PlansToRescheduleTab.tsx`) — no longer imported but preserved

## Subsequent Changes
1. The `useFollowUpData` hook still runs the same queries — no database changes needed
2. "Log as Done" writes to `script_actions` table (same as existing "Log as Sent") and updates `intros_booked.reschedule_contact_date` for the next contact date
3. The total count badge in MyDayPage still reads from `counts.total` — same data source
4. Swipe-to-dismiss writes `followup_dismissed_at` to `intros_booked` — same as existing Dismiss flow
5. No changes to any other page, component, or data flow outside the Follow-Up tab

