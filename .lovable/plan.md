## Mobile entry-form polish

Three frontend-only edits to `src/features/giveaway/components/GiveawayEntryForm.tsx`. No data, hooks, or routes change.

### 1. Kill the horizontal page scroll on mobile
`MobileStackedTitle` sets `whiteSpace: 'nowrap'` on each FitText line. Long brand names ("ORANGETHEORY FITNESS TUSCALOOSA") can't shrink below the `min` size, so the line pushes past the viewport and the whole page becomes horizontally scrollable (the white gutter in IMG_1096).

Fix: remove `whiteSpace: 'nowrap'` from `baseStyle` and pass `multiline` to each `FitText`, so long words wrap inside the viewport. Add `overflow-x-hidden` to the outer `Shell` wrapper as a belt-and-suspenders guard.

### 2. Show all prizes at a glance on mobile
`PrizeShowcase` currently renders a horizontal snap-scroll carousel on mobile (`md:hidden flex gap-2.5 overflow-x-auto …`).

Fix: replace the mobile branch with a **single-column vertical stack** of full-width prize cards (`flex flex-col gap-2.5`). Each card uses the existing `PrizeCard mobile` styling but stretches to the container width — no swiping, all prizes visible as the user scrolls down.

### 3. Remove the redundant "Presented by …" subtitle
The big title already lists every brand. The grey "PRESENTED BY ORANGETHEORY FITNESS TUSCALOOSA + HEMLINE + LUSH MED SPA + TURBO COFFEE" subtitle is duplicate noise in three spots:

- Gate view (line 257-260): delete the `<p>Presented by …</p>`.
- Post-entry view (line 483-486): delete the matching `<p>Presented by …</p>`.
- Top `CoBrandBar` rendered above the form: stop rendering it inside `GiveawayEntryForm`. (The `CoBrandBar` component itself stays in the file for other surfaces that use it — partner deck etc. — but the entry form will not render it.)

After this, `getCoBrandParts` may become unused in this file; remove the import if so.

### Verification
- Run Playwright at 390×844: scroll the entry page left/right — no horizontal scroll, no white gutter. Capture screenshot of the prize stack and confirm all 4 prizes are visible without swiping.
- Run Playwright at 1280×900: confirm desktop layout unchanged (desktop already uses a grid, not the mobile branch).
- Visit `/giveaway/tuscaloosa` to confirm both the gate (first visit) and post-entry view (resume) render cleanly with no "Presented by" line.