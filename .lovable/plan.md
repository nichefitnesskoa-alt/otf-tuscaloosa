

## Plan: My Intros Page for Coaches

This is a large feature with three changes: remove the Follow-Up tab from Coach View, add "My Intros" to bottom nav, and build the full My Intros page.

---

### Change 1 — Remove Follow-Up Tab from Coach View

**File: `src/pages/CoachView.tsx`**
- Remove the `Tabs` wrapper entirely (Intros | Follow-Up tabs)
- Keep only the Intros content inline (week day tabs, coach filter, class time groups)
- Remove `CoachFollowUpList` import and `coachFollowUpCount` state
- The Intros tab content becomes the sole content of Coach View

---

### Change 2 — Add "My Intros" to Bottom Navigation

**File: `src/components/BottomNav.tsx`**
- Coach nav items become: `Coach View` | `WIG` | `My Intros`
- Admin nav items: add `My Intros` (path `/my-intros`) between Coach View and Admin
- Use `UserCheck` icon from lucide-react for "My Intros"
- Move the existing badge count (follow-up count) from Coach View to My Intros tab
- SA nav remains unchanged: My Day | WIG | Pipeline

---

### Change 3 — Create My Intros Page

**New file: `src/pages/CoachMyIntros.tsx`**

A full page component with:

**Data fetching:**
- Primary: `follow_up_queue` where `coach_owner = currentCoach`, `owner_role = 'Coach'`, `not_interested_at IS NULL`, `transferred_to_sa_at IS NULL`
- Secondary: `intros_booked` where `coach_name = currentCoach` (all intros ever coached, including joined/cancelled)
- Merge both sources by booking ID; follow_up_queue provides follow-up status, intros_booked provides member context
- Fetch `intro_questionnaires` for questionnaire answers
- Fetch `followup_touches` for last contact info
- Fetch `intros_run` for outcome/result_canon data

**Page structure:**
1. Header: "My Intros" + subtitle
2. Priority alert bar (amber) — count of intros within 48 hours of `class_start_at`, scrolls to first on tap
3. Filter pills: All | Needs Follow-Up | 2nd Intro | Missed Guest | Joined | No-Show
4. Card list sorted by priority tier then newest class date
5. "Caught up" green banner when no follow-ups due

**Card collapsed state:** Member name, status badge, days since intro, class date, priority label, expand chevron

**Card expanded state:**
- Section 1: Member context (name, date, time, outcome, phone, questionnaire answers, SA conversation answers, last contact, contact next editor)
- Section 2: Actions — "Send Text" (opens ScriptSendDrawer), "Book 2nd Intro" (conditional), "Log as Done" (writes followup_touches, advances cadence)
- Section 3: Collapsible "View Scripts" section
- Swipe left: "Not Interested" with confirmation dialog

**"Log as Done" logic:**
- Writes to `followup_touches` (same as SA system)
- Advances `reschedule_contact_date` on the follow_up_queue record:
  - Touch 1 → +2 days
  - Touch 2 → +3 days
  - Touch 3 → +5 days
  - Touch 4+ → +7 days
- Increments `touch_number`

**48-hour priority:**
- Uses `class_start_at` from `intros_booked`
- Central Time calculation
- Overdue = contact_next date has passed

---

### Change 4 — Route Registration

**File: `src/App.tsx`**
- Import `CoachMyIntros` page
- Add route `/my-intros` with `ProtectedRoute` (no `blockCoach`)
- Accessible to Coach and Admin roles

---

### Files Changed
1. `src/pages/CoachView.tsx` — remove Follow-Up tab, keep Intros content only
2. `src/components/BottomNav.tsx` — add My Intros nav item for Coach + Admin
3. `src/pages/CoachMyIntros.tsx` — new page (full implementation)
4. `src/App.tsx` — add `/my-intros` route

