

# Auto-Generate Questionnaire on Booking Creation

## Completed

### 1. DB Trigger — `auto_create_questionnaire`
- Fires AFTER INSERT on `intros_booked`
- Auto-creates an `intro_questionnaires` row with a human-readable slug (`firstname-lastname-mondd`)
- Skips VIP/COMP bookings and 2nd intros
- Also backfills `intros_booked.questionnaire_link` with the full URL
- Every new booking now has a Q link immediately available

### 2. IntroRowCard — "Copy Q Link" button
- Added next to "Log Q as Sent" on every non-2nd-intro card
- Fetches the slug from `intro_questionnaires`, builds the URL, copies to clipboard
- If no questionnaire exists (legacy bookings), auto-creates one on the fly

### 3. Win the Day — Q links resolved from slugs
- `useWinTheDayItems` now fetches `intro_questionnaires.slug` for today's bookings
- Builds real questionnaire URLs instead of relying on the often-null `questionnaire_link` column

### 4. Script Merge Context — `{questionnaire-link}` field
- `MyDayPage` fetches the Q slug when the script drawer opens
- Injects the full URL into `scriptMergeContext` as `questionnaire-link`
- Scripts that reference `{questionnaire-link}` now auto-populate correctly

## Files Changed

| File | Change |
|------|--------|
| DB migration | `auto_create_questionnaire()` trigger function |
| `src/features/myDay/useWinTheDayItems.ts` | Fetch Q slugs, build real links |
| `src/features/myDay/IntroRowCard.tsx` | Added "Copy Q Link" button |
| `src/features/myDay/MyDayPage.tsx` | Fetch Q link for script merge context |
