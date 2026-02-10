

# Questionnaire Overhaul: Align with Full Spec

## What's Already Built vs. What Changes

The questionnaire system is already functional (auto-link generation, status tracking, response viewer, calendar download). This plan addresses the gaps between the current implementation and your full specification.

## Changes

### 1. Database Migration
Add one new column to `intro_questionnaires`:
- `q6b_available_days` (text, nullable) -- stores pipe-separated day names like "Tuesday | Thursday | Saturday"

No other schema changes needed; existing columns cover everything else.

### 2. Q1: Add Missing Option
Add "Improve a health condition or follow doctor's recommendations" to the options list. Current options are close but this one is missing.

### 3. Q2: Change from 1-10 Slider to 1-5 Tappable Buttons
- Replace the Radix slider with 5 large tappable number buttons (1 through 5)
- Show labels underneath: "Starting from scratch" (1), "Decent but inconsistent" (3), "Peak fitness" (5)
- Store value as integer 1-5 instead of 1-10

### 4. Q3: Change from Multi-Select to Single-Select + Add Missing Option
- Revert from multi-select checkboxes back to single-select cards
- Add missing option: "Cost / not sure if it's worth the investment"
- Keep the "Other" option with free text field

### 5. Q4: Replace Free Text with Q4a + Q4b (Same Screen)
- Q4a: "Have you tried other gyms or fitness programs before?" -- single-select with 3 options
- Q4b: "Did you see the results you were hoping for?" -- appears with smooth reveal animation ONLY if Q4a answer is "Yes" or "A few times but nothing consistent"
- Both on the same screen (step 4)
- Store Q4a in existing `q4_past_experience` column, Q4b as appended text (e.g., "Yes | I saw some progress but couldn't stick with it")

### 6. Q5: Change from Multi-Select to Single-Select
- Revert to single-select behavior (pick one option OR Other)
- Update question text to: "What would reaching your fitness/health goals actually mean for you?"
- Keep all 7 options and the Other field
- Remains optional

### 7. Q6: Add Q6b Day Picker on Same Screen
- After the user taps their commitment level (1-2, 3-4, 5+), a day picker appears below with smooth reveal animation
- 7 tappable day buttons (Mon-Sun) in a horizontal row/grid, multi-select
- Both Q6 and Q6b on the same screen
- Validation: Q6 selection required; Q6b is captured but not strictly required
- Save day selections to new `q6b_available_days` column

### 8. Update Step Count and Progress Bar
- Total steps stay at 9 (welcome + 7 question screens + completion) since Q4a/Q4b share a screen and Q6/Q6b share a screen

### 9. Update Response Viewer
- Show "LEVEL: X/5" instead of "X/10" in the summary card
- Add Q4b and Q6b to the full response list
- Parse Q4 to display Q4a and Q4b separately

### 10. Update Submit Logic
- `q2_fitness_level`: store as 1-5 integer
- `q3_obstacle`: store single selection (or Other text) as string
- `q4_past_experience`: store as "Q4a answer | Q4b answer" or just Q4a if Q4b was skipped
- `q5_emotional_driver`: store single selection as string (not pipe-joined array)
- `q6b_available_days`: store as pipe-separated day names

## Technical Details

### Files Modified

**Database migration:**
```sql
ALTER TABLE intro_questionnaires ADD COLUMN q6b_available_days text;
```

**`src/pages/Questionnaire.tsx`:**
- Update Q1_OPTIONS array (add 1 option)
- Replace Q2 slider with 5 tappable buttons
- Revert Q3 state from `string[]` to `string`, change render to single-select, add "Cost" option
- Replace Q4 free text with Q4a single-select + conditional Q4b reveal
- Revert Q5 state from `string[]` to `string`, change render to single-select
- Add Q6b day picker with reveal animation after Q6 selection
- Update `canProceed` validation for all changed steps
- Update `handleSubmit` to format and save all new fields

**`src/components/QuestionnaireResponseViewer.tsx`:**
- Add `q6b_available_days` to the data query
- Change level display from `/10` to `/5`
- Show Q6b available days in the full response list
- Parse Q4 to show Q4a and Q4b as separate rows
