

## Plan: Restore Questionnaire Link Auto-Generation

### Problem
The `handleLogAsSent` function in `IntroRowCard.tsx` creates questionnaire records **without a slug**, meaning the generated questionnaire has no working URL. The DB trigger handles new bookings, but for any fallback creation (e.g., older bookings), the slug is missing.

Additionally, the script context pipeline (`buildScriptContext` in `script-context.ts` and `ScriptPickerSheet.tsx`) already resolves and auto-injects `{questionnaire-link}` into scripts — this part is intact. The issue is upstream: if the questionnaire record has no slug, the link is broken.

### Changes

**1. Fix `IntroRowCard.tsx` — `handleLogAsSent` slug generation (lines 222-232)**

When creating a new questionnaire record as a fallback, generate a proper slug using `generateSlug` (from `@/lib/utils`) before inserting. Import `generateSlug` at the top.

```typescript
const newSlug = generateSlug(firstName, lastName, item.classDate);
await supabase.from('intro_questionnaires').insert({
  booking_id: item.bookingId,
  client_first_name: firstName,
  client_last_name: lastName,
  scheduled_class_date: item.classDate,
  status: 'sent',
  slug: newSlug,
} as any);
```

**2. Fix `IntroRowCard.tsx` — Ensure `buildScriptContext` receives questionnaire link when opening Script drawer**

The `myday:open-script` event already passes `bookingId` and `isSecondIntro`. The `ScriptPickerSheet` already resolves the questionnaire URL from the booking's linked questionnaire record (lines 112-172). This path is intact — no changes needed here.

**3. Verify `script-context.ts` — `buildScriptContext` questionnaire link resolution**

Already fetches questionnaire by `booking_id`, builds URL from slug, and sets `ctx['questionnaire-link']`. No changes needed — this is working.

### Summary
One file change: add `generateSlug` import and slug generation to the fallback questionnaire creation in `IntroRowCard.tsx`. The rest of the pipeline (script context, ScriptPickerSheet auto-injection) is intact and will work once records have proper slugs.

