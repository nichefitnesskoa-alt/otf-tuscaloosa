

# Fix Questionnaire Link Generation

## Problem

Two issues are causing the failure:

1. **RLS Policy Mismatch**: The INSERT policy on `intro_questionnaires` requires `auth.uid() IS NOT NULL`, but the app uses localStorage-based staff login -- not Supabase Auth. So `auth.uid()` is always NULL and every insert is blocked.

2. **Infinite Retry Loop**: When the insert fails, the error doesn't prevent re-attempts. The `useEffect` + `useCallback` in `QuestionnaireLink.tsx` keeps firing the failed insert every render cycle, producing dozens of error logs per second.

## Solution

### 1. Database: Update INSERT RLS policy

Change the INSERT policy from `auth.uid() IS NOT NULL` to `true` (allow public inserts), matching the same pattern used by the SELECT and UPDATE policies.

This is safe because:
- The table only stores questionnaire data entered by the prospect themselves
- The UUID primary key is unguessable
- No sensitive data is at risk

### 2. Code: Add error guard to prevent retry loop

In `QuestionnaireLink.tsx`, add a `failed` state flag so that if the insert fails, it stops retrying instead of hammering the database.

## Technical Details

### Database Migration
```sql
DROP POLICY "Authenticated users can create questionnaires" ON intro_questionnaires;
CREATE POLICY "Anyone can create questionnaires"
  ON intro_questionnaires FOR INSERT
  WITH CHECK (true);
```

### File: `src/components/QuestionnaireLink.tsx`
- Add a `failed` state variable
- Set it to `true` on insert error
- Check `failed` in the guard condition to prevent retries
- Show an error state in the UI instead of silently retrying

