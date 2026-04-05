

# Fix Coach View: Script Access, Post-Class Debrief, Editable Conversation Fields

## Summary
Three fixes: (1) Hide Coaching Scripts from non-Admin coaches, (2) Update post-class debrief section labels and toggle styling, (3) Make SA conversation fields editable by coaches.

## Changes

### FIX 1 — Hide Coaching Scripts from non-Admin coaches
**File: `src/pages/CoachView.tsx` (lines 232-241)**

Wrap the `TheSystemSection` and `CoachingScripts` CollapsibleSection in `{isAdmin && (...)}` so only Admin (Koa) sees them. `isAdmin` is already defined on line 70 as `user?.role === 'Admin'`.

### FIX 2 — Restore post-class debrief with updated labels and styling
**File: `src/components/coach/CoachIntroCard.tsx`**

The post-class debrief section already exists (lines 392-457) with correct fields and save logic. Changes needed:

- **Section header** (line 396): Change from `"POST-CLASS"` to `"POST-CLASS — DID YOU HIT YOUR LEAD MEASURES?"` with subtitle `"Answer after every first-timer class. This builds your scoreboard."`
- **Add shoutout consent toggle** as Column 1 in Row 1 — the existing Row 1 has shoutout start/end + goal questions in 3 columns. Restructure to:
  - Row 1 (3 cols): "Did you ask for shoutout permission?" (writes `shoutout_consent`), "Did you shout them out — start?" (`coach_shoutout_start`), "Did you shout them out — end?" (`coach_shoutout_end`)
  - Row 2 (2 cols): "Did you get curious — ask follow-up questions about their goal?" (`goal_why_captured`), "Did you introduce them to a current member?" (`made_a_friend` + `relationship_experience`)
  - Pairing plan stays as is
- **Toggle styling**: Replace Switch with Yes/No button pair using green highlight for Yes, red for No, muted gray for unset

### FIX 3 — Make conversation fields editable in Coach View
**File: `src/components/coach/CoachIntroCard.tsx` (lines 329-361)**

Replace the read-only `<p>` tags with `<Textarea>` inputs for all three conversation fields. Add:
- Debounce save on change (same pattern as whyPlan)
- Muted note below each: "Captured by [last_edited_by]" if value exists, or "Not yet captured — you can add this" if empty
- Same placeholders as SA view: "Paint me a picture...", "What would actually be different?...", "Don't fix it. Just listen..."
- Auto-save on blur, "Saved" indicator for 2 seconds

## Files Modified
1. `src/pages/CoachView.tsx` — wrap Coaching Scripts + TheSystemSection in `isAdmin` check
2. `src/components/coach/CoachIntroCard.tsx` — editable conversation fields, updated debrief header/labels/layout, styled toggles

## What does NOT change
- Database schema — all columns already exist
- Follow-up queue section — untouched
- SA view — untouched
- Realtime subscriptions — already in place, will reflect coach edits to SA view

