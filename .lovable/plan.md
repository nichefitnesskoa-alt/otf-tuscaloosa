

# Name-Based Slug Questionnaire Links

## What Changes

Questionnaire links will go from:
`otf-tuscaloosa.lovable.app/q/a1b2c3d4-e5f6-7890-abcd-ef1234567890`

To:
`otf-tuscaloosa.lovable.app/q/john-smith`

The published domain is already `otf-tuscaloosa.lovable.app` (no "shift-recap"), so no project rename needed.

## Technical Details

### 1. Database migration
- Add `slug` column (text, unique, nullable) to `intro_questionnaires`
- Backfill existing records by generating slugs from `client_first_name` + `client_last_name`
- Handle duplicate names by appending `-2`, `-3`, etc.

### 2. Slug generation helper (`src/lib/utils.ts`)
Add a `generateSlug` function:
- Converts "John Smith" to `john-smith`
- Strips special characters, collapses hyphens
- Before inserting, queries existing slugs with same prefix and appends a number if needed (e.g., `john-smith-2`)

### 3. `src/components/QuestionnaireLink.tsx`
- When creating a questionnaire, generate slug from the name and store it
- Use the published URL (`https://otf-tuscaloosa.lovable.app`) + slug for the link instead of `window.location.origin` + UUID
- Sync slug when name changes

### 4. `src/components/PastBookingQuestionnaires.tsx`
- Same change: use published URL + slug for link generation and copy
- Fetch `slug` column from existing questionnaire records

### 5. `src/pages/Questionnaire.tsx`
- Update lookup: try matching URL param against `slug` first, then fall back to `id` (UUID) for backward compatibility
```
.or(`slug.eq.${param},id.eq.${param}`)
```

### 6. `src/components/IntroBookingEntry.tsx`
- When looking up existing questionnaires for resend, also fetch the `slug` field

