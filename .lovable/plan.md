**EDITS**

**1. Extend undo to 30 minutes, not 5.** SAs run shifts. They get pulled. Five minutes is too tight.

**2. Dedupe the schedule.** Confirm dedupe. One row per unique start time

**3. Add a 4-hour check window.** Button enables when class starts. Button disables again 4 hours after class start. Past that, the row shows "Missed window" in gray. Forces real-time check-offs, not end-of-day catch-up. Yesterday's rows already disappear at midnight, but within a day you still want the discipline.

**4. Progress chip should show "X of Y checked, Z available now."** "3 / 9 classes checked" doesn't tell the SA what's actionable. Better: "3 checked, 2 available now, 4 upcoming." Drives the eye to what they can do this minute.

---

**ONE THING THE PLAN MISSED**

The check-off currently has no link to who was actually in that class. If the SA checks "5:30 PM milestones checked" but didn't actually look at the member list, the check is a lie. Two options:

a. Make the check-off require the SA to first view the class roster (link from the row to Mindbody or your class list view).

b. Trust the SA. Audit later if needed.

Let's do B.  
  
1. Tabs already orange — sweep the rest of the toggles

`src/components/ui/tabs.tsx` `TabsTrigger` already has the orange-on / light-orange-off treatment. Every Tabs surface in the app inherits it automatically — no per-page edit needed. (Already verified by reading the file.)

## 2. Switch component → orange-on / light-orange-off

Update `src/components/ui/switch.tsx` so all `<Switch>` instances app-wide read the same orange language:

- `data-[state=checked]:bg-primary` (already correct — solid OTF Orange)
- `data-[state=unchecked]:bg-primary/20` (replaces `bg-input`) so the off state is visibly the lighter orange tint
- Add `border-primary/40` so the unchecked pill has a soft orange edge
- Thumb stays white (`bg-background`) for contrast in both states

This single edit touches every switch in the app (Coach View toggles, admin panels, scorecard graph toggles, prep/script flows, etc.). No per-page changes.

## 3. My Day → "Class Milestone Checks" section (today only)

Add a new section at the bottom of `src/features/myDay/MyDayPage.tsx`, below the existing tabs, called **Today's Class Milestone Checks**.

### Behavior

- Renders only today's class times (per the schedule below, by day of week, America/Chicago).
- Each row = one class time with a single check-off button.
- The check-off is **disabled until the class start time has passed (CST)**. Disabled state shows a muted "Starts at HH:MM" hint. Once start time hits, button enables and turns solid orange ("Mark milestones checked").
- After check-off: row collapses to a green confirmed state with "Checked by {SA} at {time}" + an "Undo" affordance for 5 minutes.
- An **"+ Add celebration"** button on every row (always enabled) opens the existing celebration entry flow (the Dialog inside `MilestonesDeploySection`) so the SA can record a milestone right from My Day. The celebration is written to the `milestones` table (`entry_type = 'milestone'`) which already feeds:
  - `WigSaLeaderboard` (Milestones marked column on WIG)
  - `MilestonesDeploySection` on the WIG page
  - `useTodaysActions` (dismisses the "Mark milestone for X" todo)

No new WIG plumbing needed — the celebration data path already exists.

### Class schedule (from uploaded screenshot, day-of-week → list of start times)

```text
Mon: 5:00, 6:15, 7:30, 7:30, 8:45, 10:00, 12:30, 4:15, 5:30
Tue: 5:00, 6:15, 7:30, 7:30, 8:45, 11:15, 12:30, 12:30, 4:15, 5:30
Wed: 5:00, 6:15, 7:30, 8:45, 10:00, 12:30, 12:30, 4:15, 5:30
Thu: 5:00, 6:15, 7:30, 7:30, 8:45, 11:15, 4:15, 5:30
Fri: 5:00, 6:15, 7:30, 8:45, 10:00, 12:30, 12:30, 4:15
Sat: 8:00, 9:15, 10:30
Sun: 10:00, 11:10, 11:10
```

Stored as a constant `CLASS_SCHEDULE` in `src/lib/classSchedule.ts` (single source of truth for any future surface that needs it). Times stored in 24h CST.

**CONFIRM THIS VALUE:** Tue and Wed each have a duplicated `12:30` (and Mon/Thu have a duplicate `7:30`, Fri has duplicate `12:30`, Sun has duplicate `11:10`) in the screenshot. I'll keep both rows so each parallel class has its own check-off. Say "dedupe" if you want one row per unique time instead.

### Storage

New table `class_milestone_checks`:

- `class_date date`, `class_time time`, `checked_by text`, `checked_at timestamptz`, `unchecked_at timestamptz nullable` (for undo/audit), standard id/created_at
- Unique on `(class_date, class_time)` — only one SA needs to confirm per class
- RLS: public read/insert/update (matches `milestones` policy pattern)
- Realtime enabled so multiple SAs see check-offs live

### UI

- Card titled "Today's Milestone Checks (Mon May 11)" with a small progress chip ("3 / 9 classes checked")
- One row per class time:
  - Left: time pill (e.g. "5:30 AM")
  - Middle: status text ("Starts in 12m" / "Available now" / "✓ Checked by Bri at 5:42 AM")
  - Right: orange button — disabled (light tint) before start, solid after start, green check after done; secondary "+ Add celebration" link
- Check-off triggers single insert; row state derives from `checked_at`
- Time-aware: a 1-minute interval re-evaluates "started yet?" without refetch

## Files touched

- `src/components/ui/switch.tsx` — orange unchecked state
- `src/lib/classSchedule.ts` (new) — exported `CLASS_SCHEDULE` constant + helper `getTodayClassTimes()` (CST)
- `src/features/myDay/ClassMilestoneChecks.tsx` (new) — the new section
- `src/features/myDay/MyDayPage.tsx` — mount `<ClassMilestoneChecks />` at the bottom
- `supabase/migrations/<new>.sql` — `class_milestone_checks` table + RLS + realtime + add to publication

## Verification

- Switch in any admin panel: off state is light orange tint, on state is solid orange
- Open My Day mid-day: class times before "now" show enabled orange button, future times show disabled light-orange
- Tap "Mark milestones checked" → row turns green, "Undo" available 5 min, persists across reload
- Tap "+ Add celebration" → existing celebration dialog opens; on save the WIG page Milestones-marked count increments for the same SA on the same date
- Two SAs on shift: one checks off → other sees the green state appear via realtime within 1s
- Date rolls past midnight CST: yesterday's rows disappear, today's rows render