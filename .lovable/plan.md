Fix 6 — Win the Day text/DM source. Do not combine or max two sources. The shift recap texts_sent and dms_sent fields are the single source of truth. When an SA enters a number there it auto-completes the Win the Day task if it meets the target. Deprecate the separate outreach log as the completion trigger — shift recap input is the only trigger needed  
  
Plan: 9-Item Feature Build

This is a large scope change touching ~20+ files. Here is the implementation plan organized by task.

---

### 1. Coach Card — Add Questionnaire Answers

**File**: `src/components/dashboard/PrepDrawer.tsx`

After "THE BRIEF" read-only section (line ~601) and before "THE ARC" (line ~606), insert a "WHAT THEY TOLD US" section identical to the SA half (lines 392-431). Show only non-null fields with exact verbatim answers:

```
WHAT THEY TOLD US
Level: [X]/5
Goal: "[answer]"
Why: "[answer]"
Obstacle: "[answer]"
Commit: [X] days/week | Days: [answer]
Notes: "[answer]"
```

The data is already loaded (`questionnaire`, `fitnessLevel`, `goal`, `emotionalDriver`, `obstacle`, `commitment`, etc.) so this is purely a UI addition in the Coach Card section.

---

### 2. Members Who Bought → Studio; Commissions → Studio; Remove from Pipeline & Admin

**Files**: `src/pages/Recaps.tsx`, `src/features/pipeline/PipelinePage.tsx`, `src/pages/Admin.tsx`

- **Recaps.tsx (Studio page)**: Wrap existing content in tabs. Add two tabs at the top:
  - Tab 1: **"Members"** — import and render `MembershipPurchasesPanel`. Remove its own date selector; wire it to the Studio page's `dateRange` prop.
  - Tab 2: **"Commissions"** — import and render `PayPeriodCommission` with the Studio's `dateRange`.
  - Tab 3: **"Studio"** — existing content (Scoreboard, Lead Measures, etc.)
- **MembershipPurchasesPanel.tsx**: Add optional `dateRange` prop. When provided, use it instead of internal date selector and hide the internal selector.
- **PipelinePage.tsx**: Remove `<MembershipPurchasesPanel />` (line 203) and its import (line 47).
- **Admin.tsx**: Remove `<PayPeriodCommission>` (line 615) and its import (line 13).

---

### 3. MyDay Week Tab — Show Full Week (Mon–Sun)

**File**: `src/features/myDay/useUpcomingIntrosData.ts`

Change the `'restOfWeek'` case in `getDateRange` (lines 33-41):

- Currently: `start = tomorrow, end = Sunday`
- Change to: `start = Monday of current week, end = Sunday of current week`

This shows all intros Mon–Sun. Past days show with outcomes already logged. Today is visually highlighted.

**File**: `src/features/myDay/UpcomingIntrosCard.tsx`

Update the "Today" highlight logic in the week day pills (line 286-312):

- Add visual highlighting for the current day's pill (e.g., ring or bold border).
- Update label from "Rest of week" to "Week" in the summary strip.

---

### 4. Follow-Up Queue — Four Fixes

#### Fix A: Merge Missed Guest + Follow-Up into one "Missed Guests" tab

**File**: `src/features/followUp/useFollowUpData.ts`

- Merge `missedGuest` items into `followUpNeeded` array (or create a new combined array). People with no-show outcome, missed guest (no outcome logged, past class), or follow-up needed outcome all go into one pool.

**File**: `src/features/followUp/FollowUpTabs.tsx`

- Remove separate "Missed" and "Follow-Up" tabs. Create one "Missed Guests" tab combining both.
- Update grid from `grid-cols-5` to `grid-cols-4` (No-Show, Missed Guests, 2nd Intro, Reschedule).

**File**: `src/features/followUp/FollowUpNeededTab.tsx`

- Rename to handle combined missed guest + follow-up needed display. Add badge differentiation (no outcome vs follow-up needed vs state B).

**File**: `src/features/followUp/MissedGuestTab.tsx` — Delete (merged into FollowUpNeeded).

#### Fix B: Add "Log as Sent" button on every Follow-Up card

**Files**: `NoShowTab.tsx`, `FollowUpNeededTab.tsx`, `SecondIntroTab.tsx`, `PlansToRescheduleTab.tsx`

- Add a "Log as Sent" button that inserts a `script_actions` record with `action_type: 'script_sent'`.

#### Fix C: Add Delete/Dismiss button on every Follow-Up card

**Files**: All 4 tab components.

- Add a "Dismiss" button with confirmation dialog: "Remove [name] from follow-up queue?"
- On confirm: set `booking_status_canon = 'DISMISSED'` or add a `followup_dismissed_at` timestamp to the booking. The `useFollowUpData` query will then exclude dismissed bookings.
- Since adding a column is cleaner, add a `followup_dismissed_at` column to `intros_booked` via migration.

#### Fix D: Fix Log Outcome button linkage

**Files**: All follow-up tab components.

- The `myday:open-outcome` event requires a `bookingId`. Audit that every item in every tab has a valid `bookingId` (they do — `useFollowUpData` always provides it). The issue is likely that the outcome drawer doesn't handle bookings without a linked run. Ensure the outcome drawer can create a new run when one doesn't exist.

---

### 5. Self VIP Form Fills — Exclude from All Counts

VIP registrations that come through the self-service form create `intros_booked` records with `booking_type_canon = 'VIP'`. These are already excluded from MyDay, follow-ups, and most queries via `NOT IN ('VIP','COMP')` filters.

**Audit needed**: Check if `useDashboardMetrics`, `StudioScoreboard`, `ConversionFunnel`, `useWinTheDayItems` (booked count), and `useLeadMeasures` all exclude VIP/COMP. Add filters where missing.

**Files to audit/fix**: `src/hooks/useDashboardMetrics.ts`, `src/hooks/useLeadMeasures.ts`, `src/context/DataContext.tsx` (if aggregate counts include VIP).

---

### 6. Win the Day — Auto-Update from Shift Log Entries

**File**: `src/features/myDay/useWinTheDayItems.ts`

Currently (lines 142-148), cold texts/DMs are sourced from `daily_outreach_log`. The shift recap `texts_sent` and `dms_sent` fields are separate.

- Add a query for today's shift recap: `shift_recaps` where `staff_name = userName` and `shift_date = todayStr`.
- Combine: `totalTexts = max(outreachLog.cold_texts_sent, shiftRecap.texts_sent)` or sum them depending on intent.
- Add `shift_recaps` to the realtime subscription (line 419-431).

This way, typing numbers in the shift log auto-completes the Win the Day tasks.

---

### 7. Follow-Up Queue — Contact Timing + Last Contacted Structure

**File**: `src/features/followUp/useFollowUpData.ts`

- Add `contactNextDate` field to `FollowUpItem` interface.
- Compute defaults:
  - No-Show: next day after intro ran.
  - Missed Guest (no outcome): 3 days after class_date.
  - 2nd Intro (non-terminal): next day after 2nd intro ran.
  - Plans to Reschedule: existing 2-day default (already implemented).

**Files**: All follow-up tab components.

- Display: "Last contacted: X days ago via [type]" and "Contact next: [date]" on each card.
- Make "Contact next" editable inline — tap to open DatePickerField, save to `reschedule_contact_date` on the booking.

---

### 8. Follow-Up Queue — Remove Duplicates and Purchased

**File**: `src/features/followUp/useFollowUpData.ts`

Already partially implemented via `isTerminal()` check and `processed` set. Strengthen:

- Add explicit terminal outcome check: anyone with Purchased or Not Interested result in ANY run should be excluded.
- 2nd Intro tab priority: if someone appears in both Missed Guests and 2nd Intro, only show in 2nd Intro.
- Future unrun booking check: already implemented via `futureUnrunByName` map — verify it covers all tabs.

---

### 9. Class Times — Dropdown Everywhere

**File**: `src/types/index.ts`

- Update `CLASS_TIMES` array to include all 16 times:
`['05:00', '06:15', '07:30', '08:00', '08:45', '09:15', '10:00', '10:30', '11:10', '11:15', '12:15', '12:30', '15:00', '16:15', '17:30']`
- Update `CLASS_TIME_LABELS` with display labels for each.

**Files to replace `type="time"` inputs with `ClassTimeSelect**`:

1. `src/components/leads/BookIntroDialog.tsx` (line 192)
2. `src/components/admin/DataHealthPanel.tsx` (line 1201)
3. `src/components/dashboard/FollowUpsDueToday.tsx` (line 698)
4. `src/components/vip/ConvertVipToIntroDialog.tsx` (line 112)
5. `src/components/PastBookingQuestionnaires.tsx` (line 356)
6. `src/components/leads/ScheduleFollowUpDialog.tsx` (line 68)
7. `src/components/admin/VipGroupDetail.tsx` (line 762)
8. `src/components/admin/ClientJourneyPanel.tsx` (lines 1798, 2243, 2365, 2943, 3038)
9. `src/features/pipeline/components/VipPipelineTable.tsx` (lines 811, 838)
10. `src/features/pipeline/components/PipelineTable.tsx` (if applicable)

Each replacement: import `ClassTimeSelect` from `@/components/shared/FormHelpers` and swap the `<Input type="time">` with `<ClassTimeSelect value={val} onValueChange={setVal} />`.

---

### Database Migration

Add `followup_dismissed_at` column to `intros_booked` for Fix 4C:

```sql
ALTER TABLE public.intros_booked
ADD COLUMN IF NOT EXISTS followup_dismissed_at timestamptz DEFAULT NULL;
```

---

### Summary of Changes


| #   | Task                          | Files                                                                                  |
| --- | ----------------------------- | -------------------------------------------------------------------------------------- |
| 1   | Coach Card Q answers          | PrepDrawer.tsx                                                                         |
| 2   | Members/Commissions to Studio | Recaps.tsx, MembershipPurchasesPanel.tsx, PipelinePage.tsx, Admin.tsx                  |
| 3   | Week tab full Mon–Sun         | useUpcomingIntrosData.ts, UpcomingIntrosCard.tsx                                       |
| 4A  | Merge Missed+FollowUp tabs    | useFollowUpData.ts, FollowUpTabs.tsx, FollowUpNeededTab.tsx, delete MissedGuestTab.tsx |
| 4B  | Log as Sent button            | All 4 follow-up tab components                                                         |
| 4C  | Dismiss button                | All 4 tab components + migration                                                       |
| 4D  | Fix Log Outcome linkage       | Outcome drawer audit                                                                   |
| 5   | VIP exclusion audit           | useDashboardMetrics.ts, useLeadMeasures.ts, DataContext.tsx                            |
| 6   | Shift log → Win the Day       | useWinTheDayItems.ts                                                                   |
| 7   | Contact timing display        | useFollowUpData.ts + all tab components                                                |
| 8   | Dedup + purchased exclusion   | useFollowUpData.ts                                                                     |
| 9   | Class times dropdown          | types/index.ts + 10+ files with `type="time"`                                          |
