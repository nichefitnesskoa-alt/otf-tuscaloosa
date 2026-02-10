

# Upgrade Pre-Intro Questionnaire Links Section

## What Changes

Three improvements to the "Pre-Intro Questionnaire Links" section on the Recaps page:

### 1. Add Search Bar
A text input at the top that filters bookings by member name in real time across all tabs.

### 2. Add Tabs: "Pending" and "Completed"
Replace the current single list with two tabs:
- **Pending** -- bookings that need a link, or have a link but status is "not_sent" or "sent" (not yet completed)
- **Completed** -- bookings where the questionnaire status is "completed"

### 3. Show Questionnaire Responses for Completed Entries
Each completed entry will include an inline expandable response viewer (reusing the existing `QuestionnaireResponseViewer` component) showing the Quick-View Summary Card and full answers.

## Technical Details

### File: `src/components/PastBookingQuestionnaires.tsx`

- Add a `searchTerm` state and an `Input` field at the top of the content area
- Filter bookings by `member_name.toLowerCase().includes(searchTerm)` before splitting into tabs
- Add `Tabs` / `TabsList` / `TabsTrigger` / `TabsContent` from the existing UI components to split "Pending" vs "Completed"
- **Pending tab**: contains "Needs Link" and "Sent/Not Sent" groups (existing layout, unchanged)
- **Completed tab**: shows completed bookings with inline `QuestionnaireResponseViewer` under each entry
- Fetch questionnaire data including response fields so the viewer has what it needs (the existing `QuestionnaireResponseViewer` fetches its own data, so no extra fetch logic needed -- just pass `questionnaireId` and `questionnaireStatus`)
- Add counts to tab labels (e.g., "Pending (5)" / "Completed (3)")

### No new files or database changes needed
All UI components (`Tabs`, `Input`, `QuestionnaireResponseViewer`) already exist in the project.
