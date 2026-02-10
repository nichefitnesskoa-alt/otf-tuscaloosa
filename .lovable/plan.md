

# Questionnaire Updates: Q2 Slider, Q3 Multi-Select, Q5 Redesign

## Changes Overview

Three questions in the questionnaire get updated:

### Q2: Replace number grid with an interactive slider
- Replace the 5x2 grid of tappable buttons with a smooth, draggable slider (1-10)
- Show the selected number prominently above the slider
- Keep the three labels underneath: "Starting from scratch" (left), "Decent but inconsistent" (center), "Peak fitness" (right)
- Uses the existing Radix UI Slider component, styled with OTF orange

### Q3: Change from single-select to multi-select
- Change from picking one option to selecting multiple options (checkboxes)
- Each card gets a visual checkmark when selected, and multiple can be active at once
- "Other" option still reveals a free text field
- Validation: at least one option must be selected
- Data stored as a pipe-separated string (e.g. "Past injuries | Schedule is too busy") in the existing `q3_obstacle` column -- no database change needed

### Q5: Replace free-text with multiple-choice + optional "Other"
- New question text: "What would getting in shape actually mean for you?"
- 7 predefined options plus an "Other" with free text
- Multi-select (can pick several)
- Marked clearly as optional with the subtitle: "Totally optional, but it helps your coach understand what really matters to you."
- Validation: this step is now optional (can proceed with nothing selected)
- Data stored as a pipe-separated string in the existing `q5_emotional_driver` column -- no database change needed

## Technical Details

### File: `src/pages/Questionnaire.tsx`

**State changes:**
- `q3` (string) becomes `q3` (string array): `useState<string[]>([])`
- `q5` (string) becomes `q5` (string array): `useState<string[]>([])`
- Add `q5Other` state for the "Other" free text field

**Q5 options constant:**
```
const Q5_OPTIONS = [
  'Feel more confident in how I look and feel',
  'Have more energy for my kids, family, or daily life',
  'Prove to myself I can stick with something',
  'Reduce stress and feel mentally healthier',
  'Get off medications or improve a health condition',
  'Feel strong and capable again',
  'Keep up with activities I love (sports, hiking, travel, etc.)',
];
```

**Validation (`canProceed`):**
- Case 3: `q3.length > 0 && (!q3.includes('Other') || q3Other.trim() !== '')`
- Case 5: `true` (optional step now)

**Submit (`handleSubmit`):**
- `q3_obstacle`: join selected items with ` | `, replacing "Other" with the typed text
- `q5_emotional_driver`: join selected items with ` | `, replacing "Other" with the typed text; send null if empty

**Q2 render:** Replace the button grid with a Radix Slider showing the current value in a large number display above it, styled in OTF orange.

**Q3 render:** Toggle items in/out of the array on tap. Show a checkmark or filled state for selected items.

**Q5 render:** New multiple-choice cards (same toggle pattern as Q3), with the optional subtitle and an "Other" option that reveals an input field.

### File: `src/components/QuestionnaireResponseViewer.tsx`
- No changes needed. The viewer already displays `q3_obstacle` and `q5_emotional_driver` as plain strings, so pipe-separated values will display fine.

### Database
- No migration needed. Both columns remain `text | null`.
