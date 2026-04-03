

# Remove Win the Day, Merge Today+Week into Intros Tab, Tappable No Q Badge

## Summary
Four changes: (1) Remove Win the Day section entirely, (2) Make "No Q" badges tappable to copy Q link, (3) Replace Today+Week tabs with single "Intros" tab showing today through end of week, (4) Add Q status summary line. Apply same treatment to Coach View.

## CHANGE 1 — Remove Win the Day

### `src/features/myDay/MyDayPage.tsx`
- Remove import of `WinTheDay` (line 52)
- Remove the Win the Day section (lines 429-432): the `<div className="px-4 pb-24">` wrapping `<WinTheDay>`
- Files `WinTheDay.tsx` and `useWinTheDayItems.ts` remain in codebase but are no longer rendered

## CHANGE 2 — Tappable "No Q" Badge

### `src/features/myDay/IntroRowCard.tsx`
- Modify `getQBadge()` function (lines 41-51): for `NO_Q` case, return a `<button>` styled as the existing red badge instead of a static `<Badge>`
- Add new prop `onCopyQLink` to `IntroRowCard` — or handle internally using existing `handleSendQ` / `onSendQ` prop
- On tap: call `onSendQ(bookingId)` which already copies the Q link to clipboard. Show inline "Link copied!" text on the badge for 2s, then revert to "No Questionnaire"
- The badge in the collapsed header row (line ~232) also needs to be tappable — replace the static `getQBadge()` call with the interactive version, adding `e.stopPropagation()` so it doesn't toggle the card
- `Q_COMPLETED` and `Q_SENT` badges remain static — no tap action
- Update badge labels per UI standards: "No Questionnaire" (red), "Questionnaire Sent" (amber), "Questionnaire Complete" (green)

## CHANGE 3 — Single "Intros" Tab Replacing Today + Week

### `src/features/myDay/myDayTypes.ts`
- Add new TimeRange value: `'weekFull'` — fetches today through end of week (Sunday)

### `src/features/myDay/useUpcomingIntrosData.ts`
- Add `weekFull` case to `getDateRange()`: `start = today`, `end = sunday`

### `src/features/myDay/MyDayPage.tsx`
- Change default `activeTab` from `'today'` to `'intros'`
- Replace the two tab triggers (Today, Week) with one: `"Intros"` — for both admin and SA views
- SA tabs become: `Intros | Follow-Up` (2 tabs, `grid-cols-2`)
- Admin tabs: `Intros | Follow-Up | Leads | IG DMs | Q Hub | Outcomes` (6 tabs, `grid-cols-6`)
- Replace both `TabsContent value="today"` and `TabsContent value="week"` with single `TabsContent value="intros"`:
  - Render `<NewLeadsAlert />` at top
  - Render `<UpcomingIntrosCard userName={...} fixedTimeRange="weekFull" />`

### `src/features/myDay/UpcomingIntrosCard.tsx`
- Handle `weekFull` time range: show today's intros with orange left accent, future days with date headers
- Split items into: completed today (collapsed group at top), today active, future day groups
- Today group header: `"Today — April 3"` with `border-l-4 border-[#E8540A]`
- Future day headers: `"Tomorrow — April 4"`, `"Saturday — April 5"`, etc.
- Auto-scroll: use a ref on today's section and `scrollIntoView` on mount
- Auto-expand logic unchanged — next upcoming intro auto-expands
- For future day intros: show "Send Confirmation" button on collapsed row (reuse existing `onConfirm` handler)

## CHANGE 4 — Q Status Summary Line

### `src/features/myDay/UpcomingIntrosCard.tsx`
- When `fixedTimeRange === 'weekFull'`, show a tappable summary line above today's intros:
  `"Today: [X] intros · [Y] questionnaires sent · [Z] still needed"`
- `Z` = count of today's intros where `questionnaireStatus !== 'Q_COMPLETED'`
- On tap: scroll to first today's intro with `NO_Q` status

## CHANGE 5 — Coach View Single Tab

### `src/pages/CoachView.tsx`
- Remove Today/Week tab split (lines 237-282)
- Replace with single view fetching `weekStart` through `weekEnd` always (remove `tab` state dependency from fetch)
- Render `DateGroupView` with all bookings grouped chronologically, today's date highlighted
- Remove `tab` state and `TabsList`

## Subsequent Changes
1. Win the Day UI removed — `WinTheDay.tsx` and `useWinTheDayItems.ts` files preserved but not imported
2. The "No Q" tappable badge uses the same `onSendQ` flow already wired — copies questionnaire link to clipboard, creates/updates questionnaire record
3. Single Intros tab query uses existing `useUpcomingIntrosData` with new `weekFull` range — same data source, combined view
4. Confirmation send on future intros uses existing `onConfirm` handler — no new system
5. Coach View fetch changes from tab-dependent to always full week — same query, just no tab switching
6. No database changes needed

