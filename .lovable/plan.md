

## Use Published URL for Application Links

The application link currently uses `window.location.origin` which produces the long preview URL (`https://2a28a5d2-96cf-4364-9f40-4b9187f6bbfa.lovableproject.com/apply/koa-vincent`). The questionnaires already solve this by using the hardcoded published URL `https://otf-tuscaloosa.lovable.app`.

### Change

**One file**: `src/components/admin/HiringPipeline.tsx` — line 213

Replace:
```typescript
const url = `${window.location.origin}/apply/${slug}`;
```
With:
```typescript
const url = `https://otf-tuscaloosa.lovable.app/apply/${slug}`;
```

This matches the exact pattern used across 11 other files for questionnaire and story links. The copied URL will read:

`otf-tuscaloosa.lovable.app/apply/koa-vincent`

No other files affected. No database changes.

