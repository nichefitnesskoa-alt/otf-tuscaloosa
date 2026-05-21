# Wave 3 — Prize Display + Winner Structure

## 1. Schema migration

`supabase/migrations/<new>.sql`:
- `ALTER TABLE giveaway_partners ADD COLUMN prize_description text;`
- `ALTER TABLE giveaway_studios ADD COLUMN winner_structure text NOT NULL DEFAULT 'single';`
- `ALTER TABLE giveaway_studios ADD CONSTRAINT giveaway_studios_winner_structure_chk CHECK (winner_structure IN ('single','per_prize_with_removal','per_prize_allow_repeat'));`

After migration, `src/integrations/supabase/types.ts` regenerates automatically.

## 2. Shared types & helpers

`src/features/giveaway/lib/winnerStructure.ts` (new) — canonical source of truth:
- `export type WinnerStructure = 'single' | 'per_prize_with_removal' | 'per_prize_allow_repeat';`
- `WINNER_STRUCTURE_OPTIONS` array with `{ value, title, subtitle, icon }` for the three cards.
- `getDrawRuleStatement(ws): string` — returns the plain-English line shown on the entry form and admin summary.
- `isPerPrize(ws)`, `removesWinners(ws)` boolean helpers used by draw + wheel.

This is the single helper every consumer reads from — no hardcoded copy elsewhere.

## 3. Hooks

`useGiveawayPartners.ts`
- Add `prize_description` to insert, update, select payloads.
- Type already comes from regenerated `types.ts`.

`useGiveawayStudio.ts`
- Include `winner_structure` in select.
- `updateStudio` mutation accepts `winner_structure` and merges with existing fields (do not reset countdown/goes_live_at).

## 4. Admin Settings (`SettingsPanel.tsx`)

Partner Add/Edit form:
- New optional input `Prize for this partner` with placeholder + helper text.
- Saved alongside name, IG, instructions.
- Partner card list: under partner name show small OTF orange pill `Prize: [description]` when set.

New section `Winner Draw Rules` below Partners:
- Three full-width selectable cards (button elements, 44px+, visible border, hover, cursor pointer).
- Selected: orange border + orange tint background + white text + check indicator.
- Cards source from `WINNER_STRUCTURE_OPTIONS`.
- Selection updates local state; Save Settings persists `winner_structure` via `updateStudio` together with current countdown/goes_live_at — no field reset.
- Inline "Saved" 2s confirmation, no re-render of section.

## 5. Participant entry form (`GiveawayEntryPage.tsx`)

Fetch `winner_structure` via `useGiveawayStudio`. Fetch partners with `prize_description` via `useGiveawayPartners`.

New `PrizeShowcase` block (inline component or `components/PrizeShowcase.tsx`) placed between countdown and entry form:
- Eyebrow `WHAT YOU COULD WIN` — small caps, OTF orange, tracked.
- Horizontal scroll on mobile, grid (`md:grid-cols-3` ish) on desktop.
- Card 1 (always): orange border, badge `GRAND PRIZE`, headline `FREE OTF MEMBERSHIP`, subtext `OrangeTheory Fitness {STUDIO_CITY[slug]}`, flame/OTF mark.
- Cards 2+: one per partner where `prize_description` is set. Bold partner name, prominent OTF orange prize text, gray IG handle if set, dark bg + subtle orange border.
- Partners without `prize_description` are excluded from showcase but remain in action list below.
- Below the cards render `getDrawRuleStatement(winner_structure)` in muted text.

Partner action cards (action 5+):
- If `prize_description` set, render small pill under partner name + IG: `🎁 Prize: {prize_description}` — dark bg, OTF orange text, 11px, rounded border, no truncation.

No change to entry submission logic.

## 6. Admin entries / draw page

`DrawWinner.tsx` becomes structure-aware. Fetch `winner_structure` + partners (with prizes) on mount.

Build a `prizes` array on load:
```
[
  { id: 'membership', label: `OTF Membership — ${STUDIO_CITY[slug]}` },
  ...partners.filter(p => p.prize_description).map(p => ({ id: p.id, label: p.prize_description, partnerName: p.partner_name })),
]
```

`single` mode → unchanged UI: one DRAW WINNER button. Winner overlay lists every prize in `prizes` under the name.

`per_prize_*` mode → render a list of rows, one per prize:
- Row layout: prize label left, status middle, DRAW button right (44px, visible border).
- Row state machine in component state: `idle | drawing | drawn`. `drawnWinners: Record<prizeId, EntryRow>`.
- DRAW click → run 3-2-1 countdown animation, then `weightedDraw(pool)`:
  - Pool = entries with `total_entries > 0`.
  - `per_prize_with_removal`: pool excludes IDs already in `drawnWinners`.
  - `per_prize_allow_repeat`: pool always the full eligible set.
- On reveal: row turns green with `✓ {Winner Name}`. If removal mode, sub-note `Removed from remaining draws`.
- Once every prize has a winner, render a summary card `All prizes awarded` listing each prize → winner pair.

State is session-local — not persisted (per requirement F).

## 7. Spin wheel (`SpinWheel.tsx`)

Fetch same `prizes` list + `winner_structure`.

`single` → unchanged. Winner overlay lists all prizes.

`per_prize_*` →
- Above the wheel, prize selector dropdown: `Spinning for: [prize]` populated from `prizes`.
- Wheel pool independent from DrawWinner state (per requirement H).
- Local state `wheelRemoved: Set<entryId>`.
- After a spin in `per_prize_with_removal` mode, show prompt `Remove {winner} from wheel for next spin?` with Yes/No 44px buttons. Yes adds to `wheelRemoved` and rebuilds wheel; No leaves pool intact.
- `per_prize_allow_repeat` never modifies the wheel pool.

`weightedDraw.ts` already filters `total_entries > 0`; accept an optional `excludeIds` set used by both DrawWinner and SpinWheel.

## 8. Verification checklist (must pass before reporting done)

- Partner add/edit/list round-trips `prize_description` (DB read confirms).
- Settings save persists `winner_structure` without clearing countdown or goes_live_at.
- Entry form: prize showcase shows membership card + only partners with prizes; draw-rule line matches the selected structure for each of the 3 settings.
- Action card pill renders only when prize is set; full text, no truncation.
- DrawWinner: in removal mode a prior winner cannot be drawn again across any subsequent prize row; in repeat mode they can.
- SpinWheel removal state is independent from DrawWinner state.
- All four slugs (tuscaloosa, auburn, montgomery, vestavia) read their own studio row → behavior switches per studio.
- Role permissions unchanged; admin-only surfaces untouched for SA/Coach.

## Files touched

- `supabase/migrations/<new>.sql`
- `src/features/giveaway/lib/winnerStructure.ts` (new)
- `src/features/giveaway/lib/weightedDraw.ts` (add excludeIds)
- `src/features/giveaway/hooks/useGiveawayPartners.ts`
- `src/features/giveaway/hooks/useGiveawayStudio.ts`
- `src/features/giveaway/components/SettingsPanel.tsx`
- `src/features/giveaway/components/PrizeShowcase.tsx` (new)
- `src/features/giveaway/GiveawayEntryPage.tsx`
- `src/features/giveaway/components/DrawWinner.tsx`
- `src/features/giveaway/components/SpinWheel.tsx`
