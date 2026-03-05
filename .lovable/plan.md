

## Two Fixes

### 1. Drag-to-select not working on the questionnaire availability grid

**Root cause**: The `onPointerMove` fires on the grid container, but on touch devices the pointer events don't continue firing after the initial `pointerdown` unless `setPointerCapture` is used. The previous fix removed `setPointerCapture` (which broke `elementFromPoint`), but without it, touch drag events stop firing on the container.

**Fix**: Use `setPointerCapture` on the **grid container** (not buttons) so pointer events keep firing during drag, but use the `getBoundingClientRect` hit-testing approach (not `elementFromPoint`) to find which button the pointer is over. This gives us both: continuous events during drag AND correct element detection.

Also add `onPointerCancel` to clear drag mode, and ensure `e.preventDefault()` in `onPointerDown` to prevent scrolling during drag.

**File**: `src/pages/Questionnaire.tsx` (~lines 660-691)

### 2. Copy link not working on mobile

**Root cause**: `navigator.clipboard.writeText()` can fail on mobile browsers (especially in iframes or non-HTTPS contexts). Need a fallback using the legacy `document.execCommand('copy')` approach.

**Fix**: In `QuestionnaireLink.tsx`, wrap the clipboard call in a try/catch and fall back to creating a temporary textarea element + `execCommand('copy')`. Also add `navigator.share()` as an alternative on mobile — if the Web Share API is available, offer a share button alongside copy.

**File**: `src/components/QuestionnaireLink.tsx` (~lines 164-178)
- Add clipboard fallback function
- Add a Share button (visible on mobile) that uses `navigator.share()` for native sharing

