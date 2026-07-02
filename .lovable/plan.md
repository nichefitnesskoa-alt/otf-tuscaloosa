
## 1. Give SAs access to the Intro Scheduler Link

Assumption: the "Admin" thing SAs need is the **Intro Scheduler Link generator** (`IntroSchedulerLinkCard` — generates their personalized SA-attributed QR/link + source picker). The bookable-schedule editor stays Admin-only.

- Add a new "Intro Link" action to `QuickAddFAB` (the bottom-right `+`), which opens a sheet containing `IntroSchedulerLinkCard` pre-scoped to the logged-in SA.
- Card auto-uses `user.name` as the SA identity so the link is already attributed.

Tell me if you'd rather have it inline on MyDay instead of behind the FAB and I'll move it.

## 2. MyDay page cleanup (`src/features/myDay/MyDayPage.tsx`)

- Remove the **Activity Tracker** block (`<MyDayShiftSummary compact />`) — that's the Calls / Texts / DMs counter.
- Remove the floating **End Shift** bar at the bottom (the `CloseOutShift` wrapped in the fixed footer div). End Shift stays reachable via the FAB.
- Remove **`<SelfSourcedLeadEntry />`** (Log a lead you sourced).
- Remove both occurrences of **`<SourcedLeadsToText />`** — the standalone section AND the one inside the Follow-Up tab. Delete the import as well.

## 3. Intro card button rename

- In `src/components/myday/MyDayIntroCard.tsx`, rename the primary "Prep" button label to **"Print Questionnaire"** (icon stays, wiring stays — still opens `PrepDrawer` which then triggers print).
- On drawer open from that button we auto-fire `window.print()` so the SA lands directly on the printable sheet.

## 4. Remove "What would change for you if you got there" question

That's `q5_emotional_driver` on the questionnaire.

- `src/pages/Questionnaire.tsx`: remove the Q5 field/UI, stop sending `q5_emotional_driver` on submit (write `null`).
- Keep the DB column (historical data). No migration needed.
- Remove all reads/displays of `q5_emotional_driver` / `emotionalDriver` from `PrepDrawer.tsx` (both the on-screen prep panels and any print-side reference).

## 5. Rewrite the printable sheet (`PrepDrawer.tsx`, lines ~924–1055)

Replace the entire two-section printable block with a single full-page printout containing ONLY:

```
[Member Name]                 [Date] @ [Time]      Coach: [Name]

WHAT A 5/5 LOOKS LIKE FOR ME
  Their answer: <q1_fitness_goal or blank lines>
  ________________________________________________
  ________________________________________________
  ________________________________________________

WHAT'S BEEN HOLDING ME BACK
  Their answer: <q3_obstacle or blank lines>
  ________________________________________________
  ________________________________________________
  ________________________________________________
```

Details:
- Delete the "cut line", "COACH COPY", "THE CLOSE", EIRMA, "IF PRICE/SCHEDULE/HESITATE", meaning/obstacle secondary section — everything shown in your screenshot.
- Stretch full page: remove `maxHeight: 100vh` + `overflow: hidden` + tight 9.5px font. Use `min-height: 100vh`, generous `padding: 15mm`, headings ~18pt, answers ~13pt with 1.6 line-height.
- If questionnaire is completed: print their typed answer under each question.
- If questionnaire is missing/incomplete for that field: print 6–8 blank ruled lines under the question so the member can write in class.

## 6. Files touched

- `src/features/myDay/MyDayPage.tsx`
- `src/components/dashboard/QuickAddFAB.tsx`
- `src/components/myday/MyDayIntroCard.tsx`
- `src/components/dashboard/PrepDrawer.tsx`
- `src/pages/Questionnaire.tsx`

## 7. Coherence checks before done

- SA logs in → sees "Intro Link" in FAB → opens sheet → link/QR generated with their name pre-filled.
- MyDay for SA: no Activity Tracker, no End Shift bar, no Log-a-lead card, no Sourced-leads-to-text section (top or in Follow-Up tab). End Shift still reachable from FAB.
- Intro card button reads "Print Questionnaire"; tapping opens PrepDrawer and triggers print.
- Print output = 1 full page, 2 questions only, no EIRMA/close/screenshot section.
- Public `/q/[slug]` questionnaire no longer shows Q5.
- Existing prep on-screen panels no longer reference emotional_driver.

## Open question (only if you want to change my default)
Should the Intro Scheduler Link live **in the FAB** (my plan) or as a **card on MyDay** (always visible)? Say the word if you want it on MyDay instead.
