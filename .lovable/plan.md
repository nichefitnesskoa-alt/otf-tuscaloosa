Leave ShiftViewPage.tsx and any sibling orphan files untouched. Do not delete them in this patch. We will clean them up in a separate pass once the MyDay version is confirmed working.

Build the visual fix exactly as specced above. When done, confirm these six coherence checks passed:

Five standard sentences in ShiftChecklist imported from STANDARDS in standards.ts — not retyped

Referral task matched via REFERRAL_ASK_TASK_NAME constant only

Task to standard mapping comes only from standardForTask() — no parallel logic anywhere

Sticky header and EndOfShiftSubmission read and write the same row via useShiftSubmission — header preview reflects what the user typed in real time

Outreach counter sync to daily_outreach_log still fires for DMs and Texts inside the new card layout

No / N target rendering and no green targetHit border anywhere in the new cards

Report each check explicitly as passed or failed before calling the build done.  
  
Why the previous build looked unchanged

The grouping, sticky header, and end-of-shift card were built into `src/features/shiftView/ShiftViewPage.tsx`, but that page is **not registered in `App.tsx` and not linked from any nav**. The component the user actually sees on `/` is `src/features/myDay/ShiftChecklist.tsx` (rendered by `MyDayPage.tsx` line 338) — a flat checklist that was renamed but never restructured. That's why it looks identical to the old one.

This patch leaves the schema, completion logic, and helpers (`standards.ts`, `useShiftSubmission`, `useReferralAsks`, `ReferralAskRow`, `ReferralAskHistorySheet`, `EndOfShiftSubmission`) untouched and rebuilds the visual structure of `ShiftChecklist` to match the spec.

## Visual structure

Inside the existing orange shift wrapper (after a shift is selected), replace the current single dark card containing the flat list with three stacked zones:

```text
[ orange shift header — keep existing "Change" button ]
┌─────────────────────────────────────────────┐
│ Zone 1 — sticky reflection header (Card)    │
│   3 muted-label questions w/ draft preview  │
│   "Log the real number…" disclaimer         │
├─────────────────────────────────────────────┤
│ Zone 2 — five standard cards                │
│   Card 1: "Every intro feels expected…"     │
│     · task · task · task                    │
│   Card 2: "Every lead interaction is real…" │
│     · task · counter · counter              │
│   Card 3: "Every follow-up moves…"          │
│   Card 4: "Every member interaction counts" │
│     · task · ReferralAskRow                 │
│   Card 5: "Every piece of equipment…"       │
│   (Other) only if unmatched tasks exist     │
├─────────────────────────────────────────────┤
│ Zone 3 — Close out your shift (existing     │
│   EndOfShiftSubmission)                     │
└─────────────────────────────────────────────┘
```

## Zone 1 — sticky reflection header

- New `ShiftReflectionHeader` block inside `ShiftChecklist`, rendered inside the orange wrapper, above the standard cards.
- Sticky positioned (`sticky top-[Npx]`) so it pins below the MyDay top bar while the standards scroll. Height kept compact.
- Pulls draft answers via `useShiftSubmission(user.name, selectedShift)` and shows, per question:
  - muted label (the question)
  - one-line truncated preview of the current draft, italic muted if empty
  - clicking scrolls to `#end-of-shift`
- Inline disclaimer at the bottom of the card: "Log the real number. We can work with honest. We can't work with hidden."

## Zone 2 — five standard cards

- Replace the single flat `<div className="divide-y …">{tasks.map(...)}</div>` with a grouped render driven by `STANDARDS` from `src/features/shiftView/standards.ts`.
- For each standard:
  - One `<Card>` with a bold visible title header showing the full standard sentence.
  - Tasks for that standard render inside the card body.
  - The "Ask a member if they have a friend…" row (matched by `REFERRAL_ASK_TASK_NAME`) renders the existing `ReferralAskRow` instead of a generic checkbox; saving a referral marks the underlying task complete (same pattern already in `ShiftTaskList.tsx`).
  - Card 4 always renders the `ReferralAskRow` even if no template task is matched, mirroring `ShiftTaskList`'s s4 fallback.
- Tasks unmatched by `TASK_STANDARD_MAP` (`standardForTask` returns `'other'`) collect into a final "Other shift duties" card at the bottom, only rendered if non-empty. **No flat list anywhere.**
- Counter inputs keep their current behavior (auto-save + `syncOutreachCounter` for DMs/Texts, follow-ups counter still auto-counted from `todayFollowUpCount`) but the `/ N target` rendering and the green `border-l-2 border-l-green-500` "targetHit" treatment are removed. Counters show value + label only.
- Per-task "Send Script" button via `getScriptCategoryForTask` is preserved — it is presentation glue specific to ShiftChecklist and still useful inside the new cards.

## Zone 3 — close out card

- Render the existing `<EndOfShiftSubmission shiftType={selectedShift} />` as the last child inside the orange wrapper. It already has `id="end-of-shift"`, the three textareas, the disabled-until-non-empty Submit, and the "Edit & resubmit" state.

## Progress indicator change

- Remove the existing 12-task progress bar (`completedCount / totalCount` + percentage bar).
- Replace with a small standard-level indicator: `X of 5 standards complete`, where a standard counts complete only when **every** task inside it is checked (and, for s4, at least one referral ask has been logged today via `useReferralAsks`). Render as a single muted line above the first standard card. No bar.

## Files touched

- `src/features/myDay/ShiftChecklist.tsx` — rebuild render block (the post-shift-selected branch). All data fetching, completion writes, override handling, follow-up counter, script drawer, and shift-reset event listener stay intact.
- No new files. No schema changes. No edits to `ShiftViewPage`, `ShiftTaskList`, `EndOfShiftSubmission`, `ReferralAskRow`, `ReferralAskHistorySheet`, `standards.ts`, hooks, or migrations.

## Coherence checks before reporting done

1. Five standard sentences in `ShiftChecklist` exactly match `STANDARDS` titles in `standards.ts` (single source of truth — import, do not retype).
2. Referral-ask task name compared via `REFERRAL_ASK_TASK_NAME` constant, not a string literal.
3. Task → standard mapping comes only from `standardForTask(task.name)` — no parallel logic.
4. `EndOfShiftSubmission` and the sticky header read/write the same row via `useShiftSubmission` and stay in sync (header preview reflects what user typed in the close-out card).
5. Outreach counter sync (`daily_outreach_log`) for DMs/Texts still fires from inside the new card layout.
6. ShiftViewPage is left as-is (still unused) — no behavior change. Mention to user that it remains an orphan and can be deleted in a follow-up if not wanted.

## Open question — confirm before building

The orphaned `ShiftViewPage.tsx` (and its sibling `ShiftSelector.tsx`, `ShiftIntroCards.tsx` if also unused) duplicates the layout we're now building inside `ShiftChecklist`. Two options:

1. **Leave orphan untouched** — fastest, no risk; we delete it in a separate cleanup pass once you confirm the MyDay version is what you want.
2. **Delete orphan files in this patch** — removes the dead code now but is an extra change beyond the visual fix.

Recommend option 1 so this patch stays scoped to the visual fix you asked for. **Confirm which you prefer.**