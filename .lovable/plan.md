*One addition to the plan: the MyDay card visual redesign needs to happen in the same pass as building the shared IntroCard component. When refactoring IntroRowCard to use the shared IntroCard, apply the full visual redesign at the same time:*

- *Section divider header is a full-width dark bar above each card containing date, class time, coach, lead source, and phone all on one line*
- *Large gap between cards*
- *Member name large and dominant in card body*
- *Prepped status and copy buttons collapsed into one row*
- *Completed intros collapsed into dropdown at bottom*
- *Outcome needed orange left border and label appears 1 hour after class time*

*Do not build the shared component with the old visual language and plan to update it later. Build it right the first time.*  
  
Revised Plan: Follow-Up System Inside MyDay + Nav Changes

Four corrections applied per user feedback. No new page, no new route, no new nav item. Everything lives inside the existing MyDay F/U tab.

---

### 1. Shared IntroCard Component

**Create:** `src/components/shared/IntroCard.tsx`

Extract the section divider header + card body pattern from `IntroRowCard` into a shared component. Props:

- `memberName`, `classDate`, `introTime`, `coachName`, `leadSource`, `phone` (header fields)
- `outcomeBadge?: ReactNode` (status badge)
- `timingInfo?: string` (e.g. "3 days since last contact")
- `actionButtons: ReactNode` (tab-specific buttons passed as children/prop)
- `lastContactSummary?: string`
- `onCopyPhone?: () => void`

**Section divider header format** (full-width dark bar):

```
[Date] · [Class Time] · [Coach] · [Lead Source] · [Phone]
```

**Card body format:**

```
[Member Name] — large, dominant
[Outcome badge] · [Timing info]
[Action buttons]
[Last contact log] · Copy Phone
```

**Refactor** `IntroRowCard.tsx` to import and use `IntroCard` internally for the header/body layout, keeping all MyDay-specific logic (prep checkbox, Q status, focus mode, outcome drawer) in IntroRowCard.

---

### 2. Four-Tab Follow-Up System Inside MyDay F/U Tab

**Replace** the current `<FollowUpsDueToday>` content in the MyDay `followups` tab with a new sub-tab system.

**Create:** `src/features/followUp/useFollowUpData.ts` — single data hook returning four arrays + counts:

- **No-Show:** `result_canon = 'NO_SHOW'` on any `intros_run`, OR past `intros_booked` with no linked run and no outcome. Exclude anyone with a future unrun booking.
- **Follow-Up Needed:** `result` = 'Follow-up needed' AND no unrun future 2nd intro booking. OR 2nd intro ran with non-terminal outcome (anything except Purchased or Not Interested).
- **2nd Intro:** `booking_type_canon = 'SECOND_INTRO'` AND no matching `intros_run`.
- **Plans to Reschedule:** `booking_status_canon = 'PLANNING_RESCHEDULE'` AND no future booking.

**Create tab components** (all use shared `IntroCard`):

- `src/features/followUp/NoShowTab.tsx` — actions: [Send Text] [Book 2nd Intro]
- `src/features/followUp/FollowUpNeededTab.tsx` — State A: [Send Text] [Book 2nd Intro]. State B (2nd intro ran, non-terminal): [Gather Feedback] [Mark Not Interested]. State C: auto-moves to 2nd Intro tab.
- `src/features/followUp/SecondIntroTab.tsx` — actions: [Confirm] [Prep] [Outcome]. Show class date/time prominently.
- `src/features/followUp/PlansToRescheduleTab.tsx` — "Suggested contact: [date]" with inline date picker. Actions: [Send Text] [Book Intro]. Default 2 days from cancelled class date. Editable, saves `reschedule_contact_date` to DB.

**State B definition:** After a 2nd intro is run, card reappears in Follow-Up Needed if the 2nd intro outcome is anything other than Purchased or Not Interested. Specifically: Follow-Up Needed, No-Show, Plans to Reschedule, or any other non-terminal result removes the card from 2nd Intro tab and puts it back in Follow-Up Needed State B.

Each tab: badge count in sub-tab header, empty state message, pagination at 20 cards.

**Modify:** `src/features/myDay/MyDayPage.tsx` — replace the followups TabsContent with the new four-sub-tab component.

---

### 3. Database Migration

Add `reschedule_contact_date` column to `intros_booked`:

```sql
ALTER TABLE intros_booked ADD COLUMN reschedule_contact_date date;
```

---

### 4. Navigation Changes

`**src/components/BottomNav.tsx`:**

- SA sees: My Day · Studio (2 tabs only)
- Admin sees: My Day · Studio · Pipeline · Admin (4 tabs)

Remove Pipeline from SA nav entirely. No Follow-Up nav item added.

`**src/pages/Admin.tsx`:**

- Add "All Bookings" tab (9th tab) that renders `<PipelinePage />` for redundancy.

---

### 5. MyDay: Completed Intros Collapse

`**src/features/myDay/UpcomingIntrosCard.tsx`:**

- In the Today view, separate completed intros (has `latestRunResult`) from active.
- Show active intros normally.
- Collapsed section at bottom: "Completed Intros ([count])" — hidden by default, expandable. Still fully editable.

---

### Files to Create

1. `src/components/shared/IntroCard.tsx`
2. `src/features/followUp/useFollowUpData.ts`
3. `src/features/followUp/FollowUpTabs.tsx` (orchestrator with 4 sub-tabs)
4. `src/features/followUp/NoShowTab.tsx`
5. `src/features/followUp/FollowUpNeededTab.tsx`
6. `src/features/followUp/SecondIntroTab.tsx`
7. `src/features/followUp/PlansToRescheduleTab.tsx`

### Files to Modify

1. `src/features/myDay/IntroRowCard.tsx` — refactor to use shared IntroCard
2. `src/features/myDay/MyDayPage.tsx` — replace followups tab content, remove actions bar if present
3. `src/features/myDay/UpcomingIntrosCard.tsx` — collapse completed intros
4. `src/components/BottomNav.tsx` — SA: My Day + Studio only; Admin: + Pipeline + Admin
5. `src/pages/Admin.tsx` — add All Bookings tab with PipelinePage