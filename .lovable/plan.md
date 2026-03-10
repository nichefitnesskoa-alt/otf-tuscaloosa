
Goal: fix the two issues in the hiring flow (not the intro questionnaire flow), since the last changes were applied to the wrong components.

What I found:
- The availability schedule you’re referring to is in `src/pages/Apply.tsx` (hiring questionnaire), and it currently only supports single-cell click toggles via `onClick` on each slot button.
- The “Link copied — ready to send” toast comes from `src/components/admin/HiringPipeline.tsx`, where link copy still uses only `navigator.clipboard.writeText(...)` with no mobile fallback/share.
- The previous fixes were made in `src/pages/Questionnaire.tsx` and `src/components/QuestionnaireLink.tsx`, which are different flows.

Implementation plan:

1) Add drag multi-select to hiring availability grid (`src/pages/Apply.tsx`)
- Introduce drag state for the grid (mode: add/remove, active pointer, and last-processed cell to avoid repeated toggles while hovering same cell).
- Add pointer handlers on a common grid container:
  - `onPointerDown`: determine initial cell and drag mode (add/remove), apply first toggle, capture pointer.
  - `onPointerMove`: hit-test current cell and apply according to mode while dragging.
  - `onPointerUp` + `onPointerCancel`: clear drag state and release pointer capture.
- Keep current visual layout and selection model (`availability` object keyed by day) unchanged.
- Ensure mobile reliability:
  - apply `touch-none`/`select-none` on the interactive grid wrapper,
  - call `preventDefault()` where appropriate during drag to avoid scroll interference.

2) Fix mobile link copy in hiring pipeline (`src/components/admin/HiringPipeline.tsx`)
- Replace single clipboard write with robust copy utility:
  - try `navigator.clipboard.writeText`,
  - fallback to hidden `textarea` + `document.execCommand('copy')`,
  - show success/error toast based on actual result.
- Add optional Web Share fallback when available (`navigator.share`) so mobile users can still send the link even if clipboard APIs fail.
- Keep existing candidate token/slug generation and status refresh behavior unchanged.

3) Validate behavior (targeted)
- Hiring questionnaire (`/apply/:slug`):
  - drag across multiple time cells to “paint” selected cells,
  - drag starting from selected cell removes cells.
- Admin hiring pipeline:
  - “Send link” on desktop still copies,
  - on mobile/simulated mobile, copy works via fallback or share path, and toast reflects outcome.

Technical details
- Files to update:
  - `src/pages/Apply.tsx` (new drag interaction on availability table)
  - `src/components/admin/HiringPipeline.tsx` (clipboard fallback + share fallback)
- No schema/backend changes required; this is front-end interaction logic only.
- No change to data structure or submission payload shape (`availability_schedule` remains identical).
