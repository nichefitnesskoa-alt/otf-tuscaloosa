## Goal
Make the Own It update textareas (Last week / This week / Ideas / Ask) grow to fit their contents instead of staying at a small fixed height with an inner scrollbar. No more scrolling inside a tiny box to re-read your own update.

## Scope
Pure UI/UX change — no data, query, or attribution logic touched.

## Changes

### 1. `src/components/shared/MentionInput.tsx`
- Add auto-resize behavior to the textarea variant:
  - Set `overflow-hidden` and `resize-none` on the textarea so the native scrollbar disappears.
  - In a `useLayoutEffect` keyed on `text`, set `el.style.height = 'auto'` then `el.style.height = el.scrollHeight + 'px'` so the box grows with content.
  - Also re-run on mount and on `resetKey` change so seeded values render at full height.
- The `input` variant is untouched (used for single-line fields like the win composer's inline send).
- `min-h-[70px]` classes passed by callers still set the floor; auto-grow expands beyond it.

### 2. No other call sites need changes
- Only two `MentionInput` usages exist: the four Own It update fields (textarea) and the "Log a win" composer (textarea inside a dialog). Both benefit from auto-grow and neither has fixed-height layout constraints.

## What this fixes
- Each update field on `/the-table` now shows the whole answer at once.
- Locked-in (read-only) updates also render full height — no scrolling to see what you wrote.
- The page itself scrolls naturally; no nested scroll trap.

## Coherence note
This is cosmetic only (textarea sizing). No DB rows, hooks, query keys, or metrics are touched — skipping the coherence proof block per the cosmetic-change carve-out.