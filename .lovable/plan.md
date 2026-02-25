# Comprehensive MyDay & Studio Overhaul Plan

This is a large set of changes spanning layout restructuring, new features, data fixes, and notifications. I'll break it into phases.

---

## Phase 1: Layout Restructuring (MyDay page order)

### Current order:

1. Floating header (greeting + progress)
2. MyDayTopPanel (Studio Scoreboard + Weekly Schedule)
3. Shift Activity + End Shift
4. Win the Day
5. Tabs (Today, Week, F/U, Leads, IG DMs, Q Hub, Outcomes)

### New order:

1. Floating header (greeting + progress)
2. **End Shift button** (prominent, at top)
3. **Activity Tracker** (shift summary — calls/texts/DMs)
4. **Win the Day** checklist
5. **This Week's Schedule** (WeeklySchedule component, standalone)
6. Tabs (Today, Week, F/U, Leads, IG DMs, Q Hub, Outcomes)

**Files changed:** `src/features/myDay/MyDayPage.tsx`

- Remove `<MyDayTopPanel />` import and usage from MyDay
- Move `<CloseOutShift>` to right after the floating header
- Move `<MyDayShiftSummary>` under it
- Move `<WeeklySchedule>` to after Win the Day, before tabs
- Import `WeeklySchedule` directly

### Move Studio Scoreboard back to Studio page

**Files changed:** `src/pages/Recaps.tsx`

- Re-add `<StudioScoreboard>` to the top of the Studio/Recaps page with the same date-range-filtered metrics it had in `MyDayTopPanel`
- Import the `useQAndPrepRates` logic from `MyDayTopPanel` or inline it

**Files changed:** `src/features/myDay/MyDayTopPanel.tsx`

- This component can be removed or repurposed since its contents are being split out

---

## Phase 2: Activity Tracker in FAB (+ button)

**Files changed:** `src/components/dashboard/QuickAddFAB.tsx`

- Add a new action: `{ icon: FileText, label: 'Log Activity', onClick: handleLogActivity, color: 'bg-teal-600 text-white' }`
- This opens the `MyDayShiftSummary` in a sheet/drawer as a secondary entry point

**Files changed:** Create `src/components/dashboard/ActivityTrackerSheet.tsx`

- A `Sheet` wrapper around `MyDayShiftSummary` (non-compact mode)

---

## Phase 3: Remove "Follow-up needed" outcome button

**Files changed:** `src/components/myday/OutcomeDrawer.tsx`

- Remove `{ value: 'Follow-up needed', label: '📋 Follow-up needed' }` from `NON_SALE_OUTCOMES` array (line 39)
- Keep the follow-up banner at the bottom (the `StatusBanner` that appears after "Didn't Buy" outcomes) — that stays  
Not just specifically follow up but all non purchase options. I don't need two things showing the outcome, so remove the buttons and keep the banners

---

## Phase 4: Referrer autocomplete from pipeline

**Files changed:** `src/components/dashboard/BookIntroSheet.tsx`, `src/components/dashboard/WalkInIntroSheet.tsx`

- Replace the plain `<Input>` for "Who referred them?" with an autocomplete that:
  - Searches `intros_booked.member_name` for existing pipeline members
  - Also allows free-text manual entry
  - Uses the existing `ClientNameAutocomplete` component pattern (already exists at `src/components/ClientNameAutocomplete.tsx`)

---

## Phase 5: 2nd Visit — Previous intro info dropdown on MyDay card

**Files changed:** `src/features/myDay/IntroRowCard.tsx`

- For cards where `item.isSecondIntro === true`:
  - Add a collapsible "Previous Intro" section that fetches the original booking + run data via `originating_booking_id`
  - Shows: original date, coach, result, objection, notes, Q answers
  - Uses a `Collapsible` component for the dropdown

### Auto-mark 2nd visits as prepped

**Files changed:** `src/features/myDay/IntroRowCard.tsx`

- When `item.isSecondIntro` is true, auto-set `prepped = true` on mount if not already prepped
- Fire a single `supabase.from('intros_booked').update({ prepped: true, prepped_at: now, prepped_by: 'Auto (2nd visit)' })` call

---

## Phase 6: Copy Phone Number button

**Files changed:** `src/features/myDay/IntroRowCard.tsx`

- Add a "Copy Phone" button next to "Copy Q Link" in Row 5 (secondary actions area, around line 355)
- Only shows when `item.phone` exists

---

## Phase 7: Referral tracking fixes

### Why Mary Bennett Waller → Brinkli Wood and Caroline Viars → Allie Palmer aren't showing

The `referrals` table requires explicit entries. Referrals only appear when:

1. A booking is created with `referred_by_member_name` set, AND
2. An entry is inserted into the `referrals` table

**Investigation needed:** Check if the `BookIntroSheet` creates a `referrals` table entry when `referred_by_member_name` is set. Currently it does NOT — it only sets the column on `intros_booked` but never inserts into `referrals`.

**Fix — Files changed:** `src/components/dashboard/BookIntroSheet.tsx`, `src/components/dashboard/WalkInIntroSheet.tsx`

- After successful booking insert, if `referred_by_member_name` is set, also insert into `referrals` table:
  ```ts
  await supabase.from('referrals').insert({
    referrer_name: referredBy,
    referred_name: memberName,
    referrer_booking_id: null, // could search for referrer's booking
    referred_booking_id: inserted.id,
  });
  ```

### Friend bookings should also create referral entries

The inline friend booking flow (when someone answers "yes" to "bringing a friend?") already creates a linked booking but does NOT insert into the `referrals` table.

**Fix:** After creating the friend booking, insert a `referrals` row linking the original person as referrer and the friend as referred.

---

## Phase 8: Notification when a referred person purchases

**Database migration:** Create a `notifications` table:

```sql
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  notification_type text NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  target_user text, -- SA name or null for all
  read_at timestamptz,
  meta jsonb DEFAULT '{}'
);
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
-- RLS: authenticated can read/update their own
```

**Database trigger or app-level check:**

- In `applyIntroOutcomeUpdate`, after a sale is recorded, check if the booking has a `referred_by_member_name` or exists in the `referrals` table
- If yes, insert a notification: "🎉 {referred_name} just purchased! Referred by {referrer_name}"

**UI:** Add a notification bell icon in the header that shows unread count.

---

## Phase 9: Remove VIP Conversions & Saves/Conversions from Studio

**Files changed:** `src/pages/Recaps.tsx`

- Remove `<VipConversionCard dateRange={dateRange} />` (line 189)
- Remove the "Saves & Conversions" `<Card>` block (lines 266-290)

---

## Phase 10: Win the Day — Cold Lead Texts (30/day) and DMs (50/day).   
  
I also want the same concept with making sure new leads are being hit. The number updates if we did all of them and new leads come in

**Database migration:** Create a `daily_outreach_log` table:

```sql
CREATE TABLE public.daily_outreach_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  log_date date NOT NULL DEFAULT CURRENT_DATE,
  sa_name text NOT NULL,
  cold_texts_sent integer NOT NULL DEFAULT 0,
  cold_dms_sent integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (log_date, sa_name)
);
ALTER TABLE public.daily_outreach_log ENABLE ROW LEVEL SECURITY;
-- Open RLS for authenticated users
```

**Files changed:** `src/features/myDay/useWinTheDayItems.ts`

- Add two new item types: `cold_texts` and `cold_dms`
- Query `daily_outreach_log` for today to get total sent across all SAs
- Show: "Send 30 cold lead texts (X/30 done today)" with a reflection drawer where the SA enters how many they sent
- Same for DMs: "Send 50 DMs (X/50 done today)"

**Files changed:** `src/features/myDay/WinTheDay.tsx`

- Add reflection drawers for `cold_texts` and `cold_dms` types
- Each drawer has a number input "How many did you send?" that saves to `daily_outreach_log`
- The total subtracts across all SAs so the remaining count shrinks for later shifts

---

## Phase 11: "What's Changed" notice on login

**Database migration:** Create a `changelog` table:

```sql
CREATE TABLE public.changelog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version text NOT NULL,
  published_at timestamptz NOT NULL DEFAULT now(),
  title text NOT NULL,
  changes jsonb NOT NULL DEFAULT '[]',
  is_active boolean NOT NULL DEFAULT true
);
ALTER TABLE public.changelog ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.changelog_seen (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_name text NOT NULL,
  changelog_id uuid NOT NULL REFERENCES public.changelog(id),
  seen_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_name, changelog_id)
);
ALTER TABLE public.changelog_seen ENABLE ROW LEVEL SECURITY;
```

**New component:** `src/components/shared/WhatsChangedDialog.tsx`

- On login / app mount, check if there's a `changelog` entry the user hasn't seen
- Show a dialog with the list of changes
- Mark as seen when dismissed

**Files changed:** `src/features/myDay/MyDayPage.tsx`

- Mount `<WhatsChangedDialog />` at the top level

Changelog entries will be manually inserted by admins via the Admin panel or directly in the database.

---

## Summary of Files Changed


| File                                                | Changes                                                                                                                    |
| --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `src/features/myDay/MyDayPage.tsx`                  | Reorder layout: End Shift → Activity → Win the Day → Weekly Schedule → Tabs. Remove MyDayTopPanel. Add WhatsChangedDialog. |
| `src/features/myDay/MyDayTopPanel.tsx`              | Remove or archive (no longer used on MyDay)                                                                                |
| `src/pages/Recaps.tsx`                              | Add StudioScoreboard back. Remove VipConversionCard. Remove Saves & Conversions card.                                      |
| `src/components/dashboard/QuickAddFAB.tsx`          | Add "Log Activity" action                                                                                                  |
| `src/components/dashboard/ActivityTrackerSheet.tsx` | New — Sheet wrapper for MyDayShiftSummary                                                                                  |
| `src/components/myday/OutcomeDrawer.tsx`            | Remove "Follow-up needed" outcome                                                                                          |
| `src/components/dashboard/BookIntroSheet.tsx`       | Referrer autocomplete + insert referrals row                                                                               |
| `src/components/dashboard/WalkInIntroSheet.tsx`     | Referrer autocomplete + insert referrals row                                                                               |
| `src/features/myDay/IntroRowCard.tsx`               | Add Copy Phone button. Add 2nd visit previous intro dropdown. Auto-prep 2nd visits.                                        |
| `src/features/myDay/useWinTheDayItems.ts`           | Add cold_texts and cold_dms checklist items                                                                                |
| `src/features/myDay/WinTheDay.tsx`                  | Add cold_texts and cold_dms reflection drawers                                                                             |
| `src/components/shared/WhatsChangedDialog.tsx`      | New — What's Changed notice on login                                                                                       |
| **Database migrations**                             | `notifications`, `daily_outreach_log`, `changelog`, `changelog_seen` tables                                                |


---

## Implementation Order

Due to the size, I recommend implementing in this order:

1. **Layout restructuring** (Phase 1) — highest visual impact
2. **Remove items** (Phase 3, 9) — quick wins
3. **Copy Phone + Auto-prep 2nd visits** (Phase 5, 6) — quick wins
4. **Referral fixes** (Phase 7) — data integrity
5. **Cold texts/DMs in Win the Day** (Phase 10)
6. **Activity Tracker in FAB** (Phase 2)
7. **2nd visit dropdown** (Phase 5)
8. **Referrer autocomplete** (Phase 4)
9. **Purchase notification** (Phase 8)
10. **What's Changed dialog** (Phase 11)