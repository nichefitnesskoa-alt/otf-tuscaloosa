

# Fix Questionnaire Link in Pipeline Script Picker

## Problem

The `PipelineScriptPicker` component uses `window.location.origin` to build questionnaire links for merge fields, which produces the preview URL (`https://id-preview--2a28a5d2-...lovable.app/q/victoria-stack`) instead of the published URL.

All other components already use the hardcoded published domain -- this is the one remaining spot.

## Change

| File | What Changes |
|------|-------------|
| `src/components/dashboard/PipelineScriptPicker.tsx` | Replace `window.location.origin` with `https://otf-tuscaloosa.lovable.app` |

## Technical Detail

Line 181 currently reads:

```
setQuestionnaireLink(`${window.location.origin}/q/${data.slug}`);
```

It will be updated to:

```
setQuestionnaireLink(`https://otf-tuscaloosa.lovable.app/q/${data.slug}`);
```

This ensures all script-generated questionnaire links use the published domain, matching the pattern already established in `QuestionnaireLink.tsx`, `IntroBookingEntry.tsx`, `ClientSearchScriptPicker.tsx`, and `PastBookingQuestionnaires.tsx`.

