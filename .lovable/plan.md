

# Fix: Questionnaire Not Using Full Name

## Problem

The questionnaire link auto-creates as soon as the SA types a single character (e.g., "K") and a date is set. At that point, `client_first_name` is saved as "K" in the database. When the SA finishes typing the full name, the DB record is never updated -- so the prospect sees "Welcome, K!" instead of their full name.

## Solution

Two changes to `src/components/QuestionnaireLink.tsx`:

### 1. Delay auto-creation until the name looks complete

Add a minimum length check: require `firstName.length >= 2` before triggering the auto-create. This prevents firing on the first keystroke.

### 2. Sync name changes back to the database

After the questionnaire record is created, if the SA updates the name (finishes typing, corrects a typo, etc.), push those changes to the existing DB record. Add a `useEffect` that watches `firstName`, `lastName`, `introDate`, and `introTime` and updates the record via a debounced call whenever they change.

### Technical Details

**File: `src/components/QuestionnaireLink.tsx`**

- Change the `hasMinData` check from `firstName.length > 0` to `firstName.length >= 2`
- Add a new `useEffect` that runs when `questionnaireId` exists and `firstName`/`lastName`/`introDate`/`introTime` change:
  - Debounce 800ms to avoid spamming updates on every keystroke
  - Call `supabase.from('intro_questionnaires').update({ client_first_name, client_last_name, scheduled_class_date, scheduled_class_time }).eq('id', questionnaireId)`
- This ensures the welcome message always shows the latest, complete name

