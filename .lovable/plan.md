# MyDay + Prep Drawer + Objections Overhaul

## 1. Coach = required, TBD gets a bright alert everywhere

**New helper** `src/lib/intros/coachAttribution.ts` already has `isMissingCoach()`. Reuse it. Add a shared component `src/components/shared/TbdCoachAlert.tsx` — a solid red pill "⚠️ Coach TBD — assign now" with an `onClick` that opens the OutcomeDrawer (or booking edit) focused on the coach field.

**Enforcement — required to save any outcome:**

- `src/components/myday/OutcomeDrawer.tsx`: `handleSave` currently allows blank/TBD coach. Add validation: if `!coachName || isMissingCoach(coachName)` → `toast.error('Pick the coach who taught the class before saving')` and abort. Mark the Coach label with red `*` (remove "(optional)").
- Same guard in `src/components/dashboard/OutcomeEditor.tsx` (used from MyDay edits).

**Bright per-card alert (everywhere the intro shows):**
Show `<TbdCoachAlert/>` at top of card when `isMissingCoach(booking.coach_name)` in:

- `src/components/myday/MyDayIntroCard.tsx`
- `src/features/myDay/IntroRowCard.tsx`
- `src/components/coach/CoachIntroCard.tsx`
- `src/features/pipeline/components/PipelineRowCard.tsx`
- `src/components/dashboard/PersonListDrillDown.tsx` (drilldown rows)
- `src/components/dashboard/UnresolvedIntros.tsx`

**Top-of-MyDay banner:**
In `src/features/myDay/MyDayPage.tsx`, compute `tbdCoachBookings = bookings.filter(b => isMissingCoach(b.coach_name) && (SHOWED or ran))`. If count > 0, render a sticky red banner: "⚠️ N intros missing a coach — tap to fix" that scrolls/jumps to the first offending card.

## 2. Remove "What would change" (Q5 / meaning) from the intro card

The card question in screenshot IMG_1324 is the middle column of `TheirStory` and the middle SA-conversation field.

- `src/components/shared/TheirStory.tsx` lines 199–210: delete column 2 entirely, collapse layout to 2 columns (5/5 + Holding back).
- `src/components/dashboard/PrepDrawer.tsx` line ~450: remove the "What would change for you if you got there?" section and the paired SA conversation input.
- `src/components/coach/CoachIntroCard.tsx` line ~257: remove.
- `src/pages/CoachMyIntros.tsx` line 803: remove.
- Database column `sa_conversation_meaning` and questionnaire `q5_emotional_driver` stay in the DB (historical data) but are no longer read/written from card UIs.

## 3. Print Questionnaire renders blank — fix

Root cause: `src/index.css` uses `body > *:not([data-radix-portal]:has([data-print-card]))` — Radix Sheet portal does **not** carry a `data-radix-portal` attribute, so the `:has()` selector never matches, and every child of `<body>` gets `visibility:hidden`, including the print card that lives inside the Sheet portal.

**Fix:** Render the print card via `createPortal(node, document.body)` with a stable wrapper `<div id="print-card-root" data-print-card>` in `PrepDrawer.tsx`. Then simplify the print CSS:

```css
@media print {
  body > *:not(#print-card-root) { display: none !important; }
  #print-card-root { display: block !important; ... }
}
```

Verify by: open PrepDrawer → click Print Card → confirm 2-question sheet renders with member name, class time, coach, and Q1/Q2 answers (or blank lines).

## 4. Trim Prep Drawer — remove THE CLOSE and everything below

In `src/components/dashboard/PrepDrawer.tsx`, delete lines 539–592 (THE CLOSE block + Studio Trend block) **and** the COACH CARD section (lines ~597–893) and any subsequent script/tip sections that are not the action-button row (lines 895–913 stay). Keep: header, member story, questionnaire answers (Q1 + Q3), action buttons (Generate Script, Copy Q Link, Copy Phone, Print Card). Also drop unused imports (`Dumbbell`, `TrendingUp`, `OBJECTION_TIPS`, `studioTrend` fetch).

## 5. Deduped objection UI for 2nd-intro outcomes

`OutcomeDrawer.tsx`: when outcome is `Booked 2nd intro` or `Planning to Book 2nd Intro`, the "What's holding them back?" (SECOND_INTRO_REASON) already captures the objection. Remove the separate "Primary Objection" block for these two outcomes only. Persist the 2nd-intro reason into the same `objection` field on the run (so drilldowns show it). Keep Primary Objection for `Follow-up needed` and other non-sale paths.

## 6. New objections list (single source of truth)

Create `src/lib/intros/objections.ts`:

```ts
export const OBJECTION_OPTIONS = [
  'Price',
  'Time / Schedule',
  'Have to ask parents to pay',
  'Have to ask spouse',
  'Thinking About It',
  'Travel / Moving',
  'Trying other classes first',
  'Other',
] as const;
```

Removed: `Already a Member`, `Health / Injury`, generic `Spouse / Family`.
Added: `Have to ask parents to pay`, `Have to ask spouse`, `Trying other classes first`.

Replace inline arrays in:

- `src/components/myday/OutcomeDrawer.tsx` (line 64)
- `src/components/dashboard/OutcomeEditor.tsx` (line 10)
- `src/components/IntroRunEntry.tsx` (line 23 + tip map at 478)
- Any other match found via `rg "Pricing|Already a Member"` before editing.

Legacy values (`Pricing`, `Spousal/Parental`, `Think About It`, `Already a Member`, `Health / Injury`, `Out of Town`) still exist in historical rows — add a display-only mapper `normalizeObjectionLabel(raw)` so old rows still render the closest new label in drilldowns, and the raw value keeps working in `<Select>` (rendered as-is if not in list).

## 7. Show objection wherever people show up in drilldowns / follow-ups

Currently follow-up rows and drilldowns show name + result but drop the objection. Add a small chip "Objection: {label}" (muted, italic) whenever `run.objection` or `follow_up_queue.objection` is present in:

- `src/components/dashboard/PersonListDrillDown.tsx`
- `src/features/followUp/FollowUpList.tsx`
- `src/features/followUp/CoachFollowUpList.tsx`
- `src/features/followUp/SecondIntroTab.tsx`
- `src/features/followUp/PlansToRescheduleTab.tsx`
- `src/features/followUp/NoShowTab.tsx`
- `src/features/followUp/FollowUpNeededTab.tsx`
- `src/components/dashboard/UnresolvedIntros.tsx`
- `src/features/pipeline/components/PipelineRowCard.tsx`

Data source: prefer `intros_run.objection`, fall back to `follow_up_queue.objection`. Pull via existing hooks (add the column to selects where missing).

## Coherence proof plan (executed before I claim done)

- `SELECT id, coach_name, booking_status_canon FROM intros_booked WHERE booking_status_canon='SHOWED' AND (coach_name IS NULL OR upper(coach_name)='TBD')` → confirm those exact rows show the red pill in MyDay/Coach View/Pipeline, banner count matches.
- Open a card with `intros_run.objection = 'Pricing'` → drilldown chip renders "Objection: Price" (mapped) while stored value is unchanged.
- Print flow: click Print Card → 2-question sheet visible (not blank).
- Save an outcome with blank/TBD coach → blocked with toast; save with real coach → succeeds and TBD alerts clear.
- Booked 2nd intro flow shows one objection field (reason), not two.

## Technical notes

- No DB migration needed. All changes are UI + one new util file + one shared component.
- Print fix moves print card into a body-level portal; no other layout affected.
- All new/edited UI honors dark theme + OTF Orange primary + 44px tap targets per project standards.
- No changes to commission logic, canon fields, attribution helpers, or React Query keys — the audit reach is UI + the single objection constant.

Make sure other outcomes don't ask for objections twice