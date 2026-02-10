

# Fix: Questionnaire Links Breaking After Sync/Submit

## The Problem

Every time the name sync effect runs (which happens on re-renders, auto-save cycles, or prop changes), it generates a **new** slug with an incremented number because the `generateUniqueSlug` function doesn't exclude the current record's own slug. So:

1. You create a questionnaire for "Koa Vincent" -- slug is `koa-vincent`
2. The sync effect fires again -- it sees `koa-vincent` is "taken" and overwrites it with `koa-vincent-2`
3. It fires again -- overwrites with `koa-vincent-3`
4. The link you already copied/shared (`koa-vincent` or `koa-vincent-2`) no longer exists in the database

This is why links stop working "after a while" or after submitting.

## The Fix

### 1. Fix `generateUniqueSlug` to exclude current record (`src/lib/utils.ts`)

The function accepts an `excludeId` parameter but never uses it. Add a filter so when syncing an existing questionnaire, its own slug isn't counted as "taken."

```
// Add .neq('id', excludeId) when excludeId is provided
```

### 2. Prevent unnecessary slug regeneration (`src/components/QuestionnaireLink.tsx`)

The sync effect should only regenerate the slug when the **name actually changes**, not on every re-render. Changes:

- Track previous name values and only regenerate slug when they actually differ
- If the name hasn't changed, just sync date/time without touching the slug
- This prevents the slug from incrementing on every auto-save cycle

### No database changes needed

The `slug` column and existing data are fine -- the bug is purely in the client-side logic.

