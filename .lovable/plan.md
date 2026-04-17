
## Goal
2nd intros are not first-time experiences — coaches shouldn't be asked to log lead measures for them, the 2nd-intro coach shouldn't earn credit for running them, and the full prep card shouldn't expand on the coach's screen. Total Journey already credits the original 1st-intro coach when the 2nd intro sells; we're locking that down everywhere and removing the noise.

## What changes

### 1. Coach View — collapse 2nd intros to a one-line stub
File: `src/pages/CoachView.tsx`

When `isSecondIntro === true` for an intro in the day list:
- Render only a compact, **non-expandable** row: name + "2nd Intro" badge + time + coach.
- No chevron, no expand on tap, no `CoachIntroCard` mounted underneath.
- No "No Q Needed", "Debrief needed", or shoutout badges (those don't apply).
- Subtle visual treatment (muted background) so the coach instantly sees it's informational only.

1st intros keep the existing expandable card behavior unchanged.

### 2. Coach lead-measure denominators — explicitly exclude 2nd intros
Files audited & confirmed already correct, with one safety addition:
- `src/pages/Wig.tsx` (line 343): already filters to first intros for the WIG coach lead-measure rollup. ✅
- `src/components/dashboard/PerCoachTable.tsx`: already first-intro only with Total Journey credit. ✅
- `src/components/dashboard/CoachPerformance.tsx`: already first-intro only. ✅
- `src/components/coach/CoachIntroCard.tsx`: already skips fetching `intros_run` lead-measure fields when `isSecondIntro`. We'll go one step further — if somehow a 2nd intro card is opened (e.g. via deep link), the POST-CLASS LEAD MEASURES section is hidden entirely, and the Submit Debrief flow doesn't require those fields. (Belt and suspenders since CoachView won't expand it anymore.)

### 3. WIG tab "coach close credit" — confirm it ignores the 2nd-intro coach
`src/pages/Wig.tsx` lines 408-470: the close-rate aggregation iterates `intros_run` for **first-intro bookings only** and credits `r.coach_name` from those runs. When the 2nd intro sells, credit is added to the **first intro's coach** via the `secondRunSaleSet` lookup — never to the 2nd-intro coach. ✅ Already correct, no change needed.

### 4. Total Journey coverage for shoutout / pair / curiosity / debrief
These are first-class-only behaviors by definition — already filtered to `firstIntroBookings` in WIG. No change.

## Files changed
1. `src/pages/CoachView.tsx` — collapse 2nd-intro rows to a one-line, non-expandable stub.
2. `src/components/coach/CoachIntroCard.tsx` — hide POST-CLASS LEAD MEASURES section + skip those fields in submit validation when `isSecondIntro`. Defensive only.

## Files audited, no change needed
- `src/pages/Wig.tsx` — already first-intro only, already Total-Journey-credits 1st coach
- `src/components/dashboard/PerCoachTable.tsx` — same
- `src/components/dashboard/CoachPerformance.tsx` — same

## Downstream effects (every one explicit)
- Coach View daily list: 2nd intros render as a one-line "Name · 2nd Intro · 6:00 PM · Coach" stub with no expand.
- Coach View no longer prompts coach for shoutout/curiosity/pair/debrief on 2nd intros — those toggles never appear.
- WIG → Coach Lead Measures: denominators (coached, shoutout %, curiosity %, pair %, debrief %) continue to use first intros only — unchanged numbers.
- WIG → Coach Close Rate: credit for a 2nd-intro sale continues to flow to the **first** intro's coach via Total Journey (already in place).
- Per-Coach Performance (Studio): unchanged — already first-intro Total Journey.
- Coach Performance card: unchanged — already first-intro only.
- SA-side My Day intros tab and pipeline: unaffected.
- VIP isolation: unaffected.
- No DB / no RLS / no migrations.

## Confirm before building
None — scope is clear and matches existing canon ("first intros only" is already the standard everywhere except CoachView's expand UI).
