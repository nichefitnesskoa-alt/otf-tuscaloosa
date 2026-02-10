

# Questionnaire Tweaks

## Changes

### 1. Q3: Multi-select with Other option
Change Q3 from single-select to multi-select (same pattern used previously). Users can pick multiple obstacles. "Other" reveals a free text field. Validation requires at least one selection. Data stored as pipe-separated string in `q3_obstacle`.

### 2. Q4b: Update answer options
Replace the current Q4B_OPTIONS:
- "Yes, but I need something new" --> "Yes"
- "I saw some progress but couldn't stick with it" --> "I saw some progress but couldn't stick to it"
- (keep) "Not really"
- (add) "I just need something new"

New list: `['Yes', 'I saw some progress but couldn\'t stick to it', 'I just need something new', 'Not really']`

### 3. Q6b: Update question text
Change from: "What days are you most likely available?"
To: "What days are you most likely available to block out an hour of time to work out?"

### 4. Q7: Fix subtitle text
Change from: `"Injuries, preferences, concerns, questions — anything helps."`
To: `"Injuries, preferences, concerns, questions, anything helps."`
(Remove the dash/em-dash, replace with comma)

### 5. Darken text throughout for readability
- Body text color: `#333` --> `#1a1a1a`
- Subtitle/secondary text: `#666` and `#999` --> `#555` and `#777`
- Select card text stays `#333` (already dark enough against white cards)
- Labels under Q2 buttons: `#999` --> `#777`

## Technical Details

### File: `src/pages/Questionnaire.tsx`

**Q3 state change (line 83):** `useState('')` becomes `useState<string[]>([])`

**Q3 validation (line 133):** Change to `q3.length > 0 && (!q3.includes('Other') || q3Other.trim() !== '')`

**Q3 render (lines 337-358):** Replace `SelectCard` with multi-select toggle cards showing checkmarks when selected.

**Q4B_OPTIONS (lines 50-54):** Update to new 4 options.

**Q6b heading (line 476):** Update text.

**Q7 subtitle (line 513):** Remove em-dash, use comma.

**handleSubmit Q3 formatting (line 160):** Join array with ` | `, replacing "Other" with typed text.

**Text color updates:** Change `#666` to `#555`, `#999` to `#777`, main text `#333` to `#1a1a1a` across the component.

