## 1. Stop the app from constantly refreshing

The global React Query client (`src/App.tsx` line 43) is created with defaults, so `refetchOnWindowFocus` is `true`. Every time the user clicks back into the tab — including the preview iframe regaining focus — every query refetches and loading states flash. This matches what the session replay shows (welcome / shift recap screen and "Loading…" cycling).

**Change:** Configure the global `QueryClient` with safe defaults so refresh is opt-in, not the default.

```ts
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      staleTime: 30_000,
      retry: 1,
    },
  },
});
```

Realtime subscriptions still drive live updates where they're set up, so My Day, intros, follow-ups stay live — only the focus-triggered "everything refetches" goes away.

## 2. Questionnaire → native calendar (not an .ics download)

Today the "Add to Calendar" button at the end of `src/pages/Questionnaire.tsx` (lines 215–238) builds an .ics blob and `window.location.href`s it. On iOS Safari and Android Chrome that usually triggers a file download instead of opening the OS calendar.

**Change:** Replace the single button with three intent-based actions, with a 1-day-prior reminder built in:

- **Apple Calendar / iPhone** → real `.ics` link via an `<a href="data:text/calendar;…" download>` styled as a button. Include a `VALARM` block (`TRIGGER:-P1D`, `ACTION:DISPLAY`) so iOS imports the event with a 1-day-before alert pre-set.
- **Google Calendar** → open `https://calendar.google.com/calendar/render?action=TEMPLATE&...` in a new tab. Google's URL params do not support reminders, so we append a note in the description: "Reminder: a 1-day-before alert is recommended." (Google won't let third parties set it programmatically — this is the documented limitation.)
- **Outlook / Other** → fallback `.ics` download (same file as Apple).

Auto-detect platform via `navigator.userAgent`: on iOS show Apple first; on Android show Google first; on desktop show both side-by-side.

Reuse the same Chicago-time → UTC conversion helper already in `src/lib/vip/calendar.ts` so the date math is identical to the VIP confirmed flow. Extract a shared `buildIntroCalendarEvent({ date, time, durationMin: 60, reminderMinutes: 1440 })` into `src/lib/calendar/eventBuilders.ts` so both questionnaire and VIP pages stay coherent.

## 3. Make the questionnaire mobile-exclusive

The questionnaire (`src/pages/Questionnaire.tsx`, 836 lines) is texted to leads' phones, so it should be designed for phones first. Audit and tighten:

- Cap layout at `max-w-md mx-auto px-5` on every step.
- Bigger tap targets on `SelectCard` (min-height 56px, full-width, 16px text minimum to prevent iOS auto-zoom on focus).
- Inputs: `text-base` (16px) on all `<input>` / `<textarea>` (prevents iOS zoom). `inputmode` and `autocomplete` set appropriately (`tel`, `email`).
- Sticky bottom action bar for Continue / Back with safe-area padding (`pb-[env(safe-area-inset-bottom)]`).
- Replace any side-by-side multi-column option layouts with single-column stacks.
- Progress bar pinned to top with safe-area top padding.
- Final confirmation screen: stack the three calendar buttons vertically full-width, 48px tall.

No business logic or copy changes — just layout, spacing, and input ergonomics.

## 4. VIP Availability — week view on mobile, times visible at a glance

`src/pages/VipAvailability.tsx` currently renders a full month grid. On mobile it shows only colored dots and requires tapping into a bottom sheet to see times.

**Change:**

- On mobile (`useIsMobile()`), switch the default view to a **week-at-a-glance list**: 7 day rows stacked vertically, each row showing the date header and every slot for that day as a tappable pill with the time visible (`5:00 PM · Available`).
- Navigation: "Previous week / Next week" buttons replace month nav on mobile. Current-week disables previous-week. Header shows `Nov 17 – Nov 23`.
- Each available slot becomes a 48px-tall row with time on the left, status pill on the right, and tapping it opens the existing `ClaimDialog` directly — no intermediate sheet.
- Reserved / business / open-to-members slots render in the same list with the existing color coding and label so the visual language stays consistent with desktop.
- Add a "Switch to month view" toggle for users who want the old grid (keeps current logic intact).

Desktop is unchanged — the month grid already shows times in pills.

Files touched:
- `src/pages/VipAvailability.tsx` — add `WeekListView` component, mobile branch picks week list, desktop branch keeps month grid.
- New helper `useWeekData(weekOffset)` mirroring `useMonthData`.

## Verification

- Window focus on My Day no longer triggers visible reloads — confirmed by tabbing away and back.
- Questionnaire confirmation: on iPhone, Apple button creates an event with a 1-day alert. On Android, Google button opens a pre-filled event. On desktop, .ics downloads as fallback.
- Questionnaire renders cleanly at 375px wide with no horizontal scroll and no input zoom on focus.
- VIP availability on mobile shows the current week with every time visible without tapping; week nav advances correctly; claim flow still works end-to-end.

## Technical notes

- Files edited: `src/App.tsx`, `src/pages/Questionnaire.tsx`, `src/pages/VipAvailability.tsx`. New: `src/lib/calendar/eventBuilders.ts`.
- No DB migrations. No type changes. No role/permission changes.
- Reuses existing `date-fns` + `date-fns-tz` and existing `formatDisplayTime` / `getNowCentral` / `getTodayYMD` helpers — no new deps.
