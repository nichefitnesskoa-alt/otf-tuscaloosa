

# Shorten the Questionnaire Link

## Current State

The link customers see looks like:
```
https://otf-tuscaloosa-shift-recap.lovable.app/questionnaire/a1b2c3d4-e5f6-7890-abcd-ef1234567890
```

That's long and unfriendly in a text message.

## Change

Shorten the route from `/questionnaire/:id` to `/q/:id`. The resulting link will be:

```
https://otf-tuscaloosa-shift-recap.lovable.app/q/a1b2c3d4-e5f6-7890-abcd-ef1234567890
```

This cuts roughly 15 characters. The UUID itself must stay (it's the secure, unguessable identifier), but the path prefix gets much shorter.

We'll also keep `/questionnaire/:id` as a redirect to `/q/:id` so any previously shared links still work.

## Files Changed

### `src/App.tsx`
- Change the primary route from `/questionnaire/:id` to `/q/:id`
- Add a redirect: `/questionnaire/:id` forwards to `/q/:id` (backward compatibility)

### `src/components/QuestionnaireLink.tsx`
- Update the link template from `/questionnaire/${questionnaireId}` to `/q/${questionnaireId}`

### `src/pages/Questionnaire.tsx`
- No changes needed -- it reads the `:id` param regardless of route path

