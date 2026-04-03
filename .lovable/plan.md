

# Simplify SA Experience + New Leads Alert + Tooltips + Inline Edit

## Summary
Seven changes: login message, My Day top message, SA nav reduction to 2 tabs, inner tabs reduction to 3, new leads alert on Today view, hover tooltips on all sections, and inline edit modal on intro cards.

## Changes

### 1. Login Screen Message — `src/pages/Login.tsx`
Add bold white text block above the name selector inside the Card:
- Bold: "This app tracks your commission, proves your value to leadership, and makes sure you never lose credit for an intro you worked. The OTF system books classes. This system makes sure you get paid for them."
- Below in muted smaller text: "Remember: book every intro in both Mindbody AND here."

### 2. My Day Top Message — `src/features/myDay/MyDayPage.tsx`
Below the greeting/date row (after line 262), add a persistent amber-left-border banner:
```
"Book in Mindbody AND here. This is how you get credit and commission."
```
Styled: `border-l-4 border-[#E8540A] bg-muted/50 px-3 py-2 text-xs font-medium`

### 3. SA Bottom Nav — `src/components/BottomNav.tsx`
Change `visibleItems` for non-admin users from 4 items to 2:
```typescript
const visibleItems = isAdmin ? [
  { path: '/my-day', label: 'My Day', icon: Home },
  { path: '/recaps', label: 'Studio', icon: TrendingUp },
  { path: '/wig', label: 'WIG', icon: Trophy },
  { path: '/pipeline', label: 'Pipeline', icon: GitBranch },
  { path: '/coach-view', label: 'Coach View', icon: Eye },
  { path: '/admin', label: 'Admin', icon: Settings },
] : [
  { path: '/my-day', label: 'My Day', icon: Home },
  { path: '/wig', label: 'WIG', icon: Trophy },
];
```
Studio, Pipeline, Coach View removed from SA nav. Routes still work if navigated directly.

### 4. My Day Inner Tabs — `src/features/myDay/MyDayPage.tsx`
Reduce tab bar from 7 tabs to 3 for SA role. Check `user?.role` — if not Admin, show only: Today, Week, Follow-Up. Admin sees all 7 tabs. Change `grid-cols-7` to `grid-cols-3` for SA. Remove IG DMs, Q Hub, Outcomes, Leads tab triggers and content for SA view (wrap in `isAdmin` conditional). The Leads tab data moves to the new alert in Change 5.

### 5. New Leads Alert on Today Tab — `src/features/myDay/MyDayPage.tsx`
Create a `NewLeadsAlert` component (inline or separate file) that:
- Queries `leads` table for `stage = 'new'` created in last 24 hours
- Cross-checks `lead_activities` — only shows leads with zero activities
- Renders an amber card between ShiftChecklist and UpcomingIntrosCard in the Today tab content
- Shows: "New Leads — Respond Now" header, "[X] new leads need a first touch" subtext
- Each lead row: name, source, time since arrival, "Send Script" button that dispatches `myday:open-script` or opens ScriptPickerSheet
- Hidden entirely when no qualifying leads exist

Data source: reuse logic from `MyDayNewLeadsTab` but simplified — only the "new" sub-tab with zero activities filter.

### 6. Tooltips — New `src/components/shared/SectionTooltip.tsx`
Create a reusable tooltip wrapper using existing `TooltipProvider/Tooltip/TooltipTrigger/TooltipContent` from radix. Wraps a `HelpCircle` icon (or info icon with text label per standards). Apply to:

| Location | Tooltip text |
|---|---|
| My Day header | "Your shift home. Tasks, intros, and new leads — everything you need for this shift." |
| Shift Duties section | "Your responsibilities for this shift. Complete these in order." |
| Upcoming Intros section | "First-timers coming in today. Prep them before class." |
| Follow-Up tab | "People who didn't buy. Your job is to get them back. One touch per person per day." |
| Week tab | "Upcoming intros for the rest of the week. Send confirmation texts from here." |
| WIG tab (`src/pages/Wig.tsx`) | "Your lead measures and the studio's quarterly targets. This is the scoreboard." |
| Milestones & Deploy (`src/pages/Wig.tsx`) | "Celebrate members and put their friends in the pipeline." |
| Coach View header | "Your intro cards for today's classes. Prep before class, debrief after." |
| Post-Class debrief | "Five questions. Fills the scoreboard. Takes 60 seconds." |
| Pipeline (Koa) | "Full lead history and booking edits. For fixes and research — not daily workflow." |
| Studio (Koa) | "Analytics and performance data for the studio." |
| Admin (Koa) | "Settings, staff management, and system controls." |

Style: dark bg, white text, 12px, max-w-[220px], rounded-md. On mobile use Popover instead of Tooltip for long-press.

### 7. Inline Edit Modal on Intro Cards — `src/features/myDay/IntroRowCard.tsx`
Add an "Edit" button (pencil icon + "Edit" text label) to the expanded card's action bar. Clicking opens a Dialog/Sheet with four fields:
- Coach name (NameAutocomplete or text input)
- Class time (time input)
- Lead source (select from existing sources)
- Booking attribution: `intro_owner` and `booked_by` (text inputs)

Save writes directly to `intros_booked` via `supabase.from('intros_booked').update(...)`. Shows inline "Saved" confirmation for 2s. Cancel button outlined, Save button orange. All inputs 44px min height.

New component: `src/components/myday/EditBookingDialog.tsx`

## Files Modified
1. `src/pages/Login.tsx` — add message text
2. `src/features/myDay/MyDayPage.tsx` — top message, tab reduction, new leads alert
3. `src/components/BottomNav.tsx` — SA nav to 2 tabs
4. `src/components/shared/SectionTooltip.tsx` — new reusable tooltip
5. `src/features/myDay/ShiftChecklist.tsx` — add tooltip to shift duties header
6. `src/features/myDay/UpcomingIntrosCard.tsx` — add tooltip to intros header
7. `src/features/myDay/IntroRowCard.tsx` — add Edit button
8. `src/components/myday/EditBookingDialog.tsx` — new inline edit dialog
9. `src/pages/Wig.tsx` — add tooltips to WIG and Milestones headers
10. `src/pages/CoachView.tsx` — add tooltip to Coach View header
11. `src/pages/Recaps.tsx` — add tooltip (Koa only)
12. `src/pages/Pipeline.tsx` — add tooltip (Koa only)
13. `src/pages/Admin.tsx` — add tooltip (Koa only)
14. `src/features/myDay/NewLeadsAlert.tsx` — new component for Today tab alert

## Subsequent Changes
1. Pipeline, Studio, Coach View routes remain functional — only nav visibility changes for SA role
2. IG DM scripts remain accessible from intro card script drawers — only the dedicated tab is hidden from SA
3. New Leads alert reads from existing `leads` + `lead_activities` tables — no new tables
4. Tooltips are display-only — no data or logic changes
5. Inline edit writes to `intros_booked` same as Pipeline — same table, same columns
6. The Leads tab content (`MyDayNewLeadsTab`) is still rendered for Admin — only hidden from SA tabs
7. Q Hub and Outcomes tabs still rendered for Admin — only hidden from SA

