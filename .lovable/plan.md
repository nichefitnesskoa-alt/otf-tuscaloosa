

# Win the Day Navigation + Section Banners + Tab Separators + Phone Fix + Week Tab Days

## 5 Changes

### 1. Win the Day action buttons navigate directly to the correct card/tab (`src/features/myDay/WinTheDay.tsx`)

Currently, `confirm_tomorrow` switches to the `intros` tab and shows a toast saying "Navigate to the intro card." Instead, all action buttons should switch to the correct tab AND scroll to the specific card.

**Changes:**
- `confirm_tomorrow` → switch to `week` tab (tomorrow's intros are in the Week tab), then after a short delay, scroll to the element with `id="intro-card-{bookingId}"` using `scrollIntoView`
- `q_send` / `q_resend` → keep existing copy behavior, but ALSO switch to `today` tab and scroll to the card
- `prep_roleplay` → switch to `today` tab and scroll to the card, then open the prep drawer
- `followups_due` → already switches tab (good)
- `leads_overdue` → already switches tab (good)
- Remove the toast "Navigate to the intro card to send confirmation"

**In `IntroRowCard.tsx`**: ensure each card has `id={`intro-card-${item.bookingId}`}` on its outer div for scroll targeting.

### 2. Section guidance banners for every major section (`src/features/myDay/MyDayPage.tsx`, `src/features/myDay/WinTheDay.tsx`)

Add a short, always-visible explanation banner at the top of each section:

- **Win the Day**: "Your shift checklist. Complete every item to win the day. Tap ○ to reflect, tap the button to take action."
- **Activity Tracker**: "Quick view of your shift stats. Log activity from the FAB."
- **Weekly Schedule**: "Your upcoming schedule at a glance."
- **End Shift**: "Close out your shift with a recap when you're done."
- **Each tab content area**: Brief guidance text below the tab bar (Today: "Your intros for today, sorted by class time.", Week: "Upcoming intros grouped by day.", etc.)

Implementation: a small `SectionGuide` component — a muted text block with a subtle left border or background, rendered inline at the top of each section.

### 3. Visual divider between tabs (`src/features/myDay/MyDayPage.tsx`)

Add a visible separator line between the tab bar and the content below. Currently the tabs sit in a `TabsList` with no clear bottom edge. Add a `border-b-2 border-primary/40` or a `<Separator>` below the `TabsList` and above the `TabsContent`.

Also add `border-b` between each tab trigger to create visual separation between the tab items themselves — using a thin vertical divider or spacing gap with a visible border.

### 4. Fix Katherine Bibb Branyon phone not showing (`src/features/myDay/useUpcomingIntrosData.ts`)

The phone field is fetched from `intros_booked` in the select query (line 85). The data hook uses `phone_e164 || phone` (line 183). If neither field has data in the DB row for this booking, the card shows no phone.

**Root cause**: The booking was likely imported from email/sheets without running `extractPhone` on the raw body. 

**Fix**: In `useUpcomingIntrosData.ts`, after building raw items, add a fallback step: if `phone` is null, check if the booking has an `email` field containing a phone number (common in OTF email imports), and run `extractPhone` on it client-side. Also check the `lead_source` or `notes` fields.

Additionally, add the `notes` field to the select query on `intros_booked` so we have more raw text to parse for phone numbers.

### 5. Week tab: internal day-based sub-tabs (`src/features/myDay/UpcomingIntrosCard.tsx`, `src/features/myDay/IntroDayGroup.tsx`)

Currently the Week tab renders all days in a single scrollable list with just a small date header. Need clearer day separation.

**Approach**: When `fixedTimeRange === 'restOfWeek'`, render an internal horizontal pill-style tab row at the top with each day of the week (e.g., "Thu", "Fri", "Sat", "Sun"). Tapping a day shows only that day's intros. Default to the first day with intros.

**Changes to `UpcomingIntrosCard.tsx`**:
- When `fixedTimeRange === 'restOfWeek'` and `dayGroups.length > 1`, render a secondary tab bar with day labels
- Add state `selectedWeekDay` defaulting to the first day group's date
- Filter `dayGroups` to only the selected day
- Show a count badge on each day pill

**Changes to `IntroDayGroup.tsx`**:
- Add stronger visual separation: a thicker border-top, a more prominent date header with background color

## Files Changed

| File | Change |
|------|--------|
| `src/features/myDay/WinTheDay.tsx` | Navigate to specific cards on action tap; add section guidance banner |
| `src/features/myDay/IntroRowCard.tsx` | Add `id` attribute to card outer div for scroll targeting |
| `src/features/myDay/MyDayPage.tsx` | Add section guidance banners to each section; add visual tab separator |
| `src/features/myDay/useUpcomingIntrosData.ts` | Add `notes` to select query; run `extractPhone` fallback on email/notes for missing phone |
| `src/features/myDay/UpcomingIntrosCard.tsx` | Add internal day sub-tabs for Week view |
| `src/features/myDay/IntroDayGroup.tsx` | Stronger visual day separation with thicker borders and colored header |

