## Wave 2 Brand Polish — Plan

Apply Wave 1 semantic tokens to four surface areas. Color-only edits. No layout, spacing, font, or logic changes. Giveaway feature untouched.

### Path corrections from prompt

Two scope paths in the prompt don't match the codebase. Confirming I'll use the actual paths:

- **Scripts**: prompt says `src/features/scripts/` — actual location is `src/components/scripts/`. Will edit: `TemplateCategoryTabs.tsx`, `SequenceTracker.tsx`, `ScriptSendDrawer.tsx`, `ScriptPickerSheet.tsx`, `MessageGenerator.tsx`.
- **Pipeline**: prompt lists files at `src/features/pipeline/PipelineSpreadsheet.tsx` etc. — actual location is `src/features/pipeline/components/`. Will edit: `components/PipelineSpreadsheet.tsx`, `components/PipelineNewLeadsTab.tsx`, `components/PipelineRowCard.tsx`, `components/PipelineDialogs.tsx`.

### Pre-confirmations (defaults if no answer)

1. **Cooling badge color** (CoolingToggle.tsx): prompt flags this as CONFIRM. Default: `bg-warning-dim text-warning` (amber, per spec's primary recommendation). Override only if you say otherwise.
2. **Today's Shift banner** (ShiftChecklist.tsx) currently uses raw `bg-[#E8540A]` and `text-white` — will swap to `bg-brand` / `text-brand-foreground`. Same visual result, semantic tokens.
3. **One-orange-per-screen rule**: where two filled-orange CTAs would currently appear together (e.g. "Send Script" on New Leads card while End Shift is also visible), the per-card CTA gets downgraded to outlined `bg-surface-card border-brand text-brand` as the prompt directs.

### Execution order

Process one surface fully before moving to the next. For each file:
1. Read fully.
2. Map every hardcoded color (hex, rgb, `text-{color}-{n}`, `bg-{color}-{n}`, `border-{color}-{n}`) to its semantic intent.
3. Replace all instances consistently.
4. Re-scan the file for any remaining hardcoded color classes — must be zero before moving on.

**Surface 1 — My Day** (9 files): MyDayPage, IntroRowCard, WinTheDay, TodaysActions, MyDayNewLeadsTab, UpcomingIntrosCard, ShiftChecklist, VipClaimBanner, ClassMilestoneChecks.

**Surface 2 — Follow-Up** (6 files): FollowUpList, FollowUpNeededTab, NoShowTab, SecondIntroTab, PlansToRescheduleTab, CoolingToggle. `useFollowUpData.ts` scanned for color string literals only (no logic edits).

**Surface 3 — Scripts** (5 files): TemplateCategoryTabs, SequenceTracker, ScriptSendDrawer, ScriptPickerSheet, MessageGenerator (all under `src/components/scripts/`).

**Surface 4 — Pipeline** (4 files): PipelineSpreadsheet, PipelineNewLeadsTab, PipelineRowCard, PipelineDialogs (all under `src/features/pipeline/components/`).

### Token mapping rules applied

Status semantics enforced uniformly:

```text
bg-brand / text-brand        → primary action, active state (1 per screen)
bg-brand-dim / text-brand    → brand-tinted selection, VIP chip
bg-success-dim / text-success → sold, completed, verified, 1st Intro badge
bg-warning-dim / text-warning → pending, cooling, due-soon, planning, merge placeholders
bg-danger-dim  / text-danger  → overdue, no-show, missed, urgent
bg-neutral-dim / text-neutral → inactive, locked, secondary categorical chips
bg-surface-card / -hover / -border / -input → backgrounds
text-text-primary / -secondary → body text hierarchy
```

Secondary buttons everywhere: `bg-surface-card border-surface-border text-text-primary` (or `text-text-secondary` for de-emphasized).

### Verification checklist (run before reporting done)

Per file:
- `rg "(bg|text|border)-(red|orange|amber|yellow|green|emerald|blue|sky|purple|pink|gray|slate|zinc|neutral)-(50|100|200|300|400|500|600|700|800|900)" <file>` → must return zero
- `rg "#[0-9a-fA-F]{3,8}" <file>` → must return zero color hex literals (allow non-color values if any)
- `rg "rgb\(|rgba\(|hsl\(" <file>` → must return zero raw color functions

Cross-file:
- Count `bg-brand` filled buttons rendered simultaneously per screen — at most one per visible viewport.
- Follow-Up category badges visually distinct from owner badges and overdue badge.
- Pipeline selected row uses `bg-brand-dim`, not solid `bg-brand`.
- Pipeline "Purchased" stat number is `text-success`.
- Tab urgent count badges remain `bg-danger`.
- Progress bars use `bg-surface-border` track + `bg-brand` fill.
- Giveaway feature: `git diff src/features/giveaway/` shows no changes.

### Final report will include

- Files touched (count per surface)
- Any element that needed CONFIRM THIS VALUE flagging
- Verification grep results (zero hardcoded colors per file)
- Any places where the prompt's literal spec conflicted with existing layout and how it was resolved (color-only, never layout)

Wave 3 surfaces (WIG, Coach View, Scorecard, Studio) will NOT be touched.
