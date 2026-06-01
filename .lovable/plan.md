## Goal
Make the script-per-date list in the "Workout Templates With Class Times" section take less vertical space by replacing each full-width row with compact cards that wrap horizontally.

## Change (UI only, `src/components/coach/CoachingScripts.tsx`)
Replace the current `scripts.map(...)` full-width row rendering with a responsive flex-wrap grid of small chip-style cards. Behavior preserved exactly:
- Click card → opens viewer (`setViewingScript`)
- Admin trash icon → `handleDelete` (still `stopPropagation`)
- Format badge color via existing `FORMAT_STYLES`

### Card layout
- Container: `flex flex-wrap gap-2`
- Each card: fixed-ish width (e.g. `w-[140px]`), `rounded-lg border border-border bg-card px-2.5 py-2`, hover state, cursor-pointer
- Contents stacked vertically:
  - Top row: format badge (left) + trash icon (right, admin only, small)
  - Bottom: date title (`s.title`, e.g. "2G — Jun 3"), `text-xs font-medium`, truncate
- 44px min height preserved (`min-h-[44px]`)

### Untouched
- Upload button, dialog, parsing, fetch, delete logic, viewer, schema, queries — all unchanged.
- No other files modified.

## Why this shape
Dropdown was offered as an option, but small wrap-cards keep one-tap access (no two-step open-then-pick), match the dark-theme card style already used elsewhere, and collapse ~30 rows into 3–4 rows of chips at this viewport. Format badge stays visible so 2G/3G are still scannable.

## Verification
- Visual: list renders as wrapping grid of compact cards on /coach-view (admin route — accessed via collapsible "Workout Templates" section).
- Click a card → viewer opens with correct script.
- Admin trash → confirm + delete still works, doesn't open viewer.
- Non-admin (no trash) still sees cards and can open.