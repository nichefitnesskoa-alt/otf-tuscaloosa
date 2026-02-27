

## Two Changes

### 1. Fix Script Generation: Switch from Anthropic to Lovable AI

The `generate-script` edge function calls `api.anthropic.com` directly, but the Anthropic account has no credits. Switch to the Lovable AI gateway (`https://ai.gateway.lovable.dev/v1/chat/completions`) using the pre-configured `LOVABLE_API_KEY`.

**File: `supabase/functions/generate-script/index.ts`**
- Replace the Anthropic fetch call with Lovable AI gateway call
- Use `google/gemini-2.5-flash` model (fast, good for this use case)
- Change from `ANTHROPIC_API_KEY` to `LOVABLE_API_KEY`
- Adapt request/response format from Anthropic to OpenAI-compatible format
- Keep the full KOA_SYSTEM_PROMPT unchanged

### 2. Delete the daily-followup-digest edge function

**Delete: `supabase/functions/daily-followup-digest/index.ts`**
- Remove the entire edge function directory

Also remove the `FollowUpDigest` admin component if it references this function.

