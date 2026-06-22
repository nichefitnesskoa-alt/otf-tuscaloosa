## Two fixes for the giveaway

### 1. Prize text overflows the showcase card

`src/features/giveaway/components/PrizeShowcase.tsx` currently fits the prize headline with `line-clamp-2` and a large `clamp(22px, 2.4vw, 36px)` desktop font. "DIAMOND GLOW FACIAL + HORMONE LABS" can't fit in two lines at that size, so it truncates to "DIAMOND GLOW…".

Changes (visual only):
- Replace fixed `height` (160 / 180) with `minHeight` of the same value — card can grow if a long prize needs the room, cards in the same row stay equal via CSS grid stretch.
- Drop the desktop clamp upper bound to `clamp(15px, 1.6vw, 22px)` and mobile to `clamp(14px, 4.2vw, 18px)`.
- Remove `line-clamp-2`; add `break-words hyphens-auto` so long phrases wrap cleanly across up to 4 lines.
- Tighten letter-spacing slightly and keep `leading-[1.05]` so multi-line prizes still feel like one block.

No content/data changes — pure presentation fit.

### 2. One prize input per winner

Today a partner has one `prize_description` and a `prize_count`. If Lush has 2 winners, the showcase repeats the same label twice (e.g. "DIAMOND GLOW…" / "DIAMOND GLOW…"). Koa wants distinct prize labels per winner slot.

**DB (migration):**
- Add `prize_labels jsonb` (nullable) to `public.giveaway_partners`. Holds an array of trimmed strings, length must equal `prize_count` when set. No CHECK constraint (avoid immutability issues); validate at the app layer.
- Backfill: leave existing rows with `prize_labels = NULL` → readers fall back to `prize_description` (no visible change for current partners).

**Hook (`useGiveawayPartners.ts`):**
- Add `prize_labels: string[] | null` to both the row type and `PartnerInput`.
- In `add`/`update`: when `prize_count > 1`, write `prize_labels` (trimmed, length = prize_count, each non-empty). When `prize_count === 1`, store `prize_labels = null`. Always mirror the first label into `prize_description` so card badges / summaries / legacy readers stay coherent.

**Admin form (`SettingsPanel.tsx` `PartnerForm`):**
- When `prizeCount === 1` → keep today's single "Prize for this partner" input.
- When `prizeCount > 1` → swap the single input for `prizeCount` labeled inputs: "Prize for winner 1", "Prize for winner 2", … Each required. Adjusting the stepper resizes the array (keeps existing values, appends blanks on grow, trims on shrink, with a confirm when shrink would drop a non-empty value).
- `PartnerCard` badge: when multiple distinct labels exist, show "PRIZES: Label A · Label B · Label C"; otherwise keep the current "PRIZE: X × N" form.

**Showcase (`PrizeShowcase.tsx`) + Draw (`DrawWinner.tsx`):**
- Both already loop `0..prize_count` to produce per-slot entries. Update both to read `p.prize_labels?.[i] ?? p.prize_description` when building the per-slot prize text/label so each slot shows its own prize. No structural change to the loop.

**Out of scope:**
- No change to entry form (still one set of partner action rows per partner — winners are drawn from the same entry pool).
- No retroactive split of existing single-input partners (they keep working via the `prize_description` fallback).
- No change to `winner_structure` or draw mechanics beyond the per-slot label.

### Coherence proof I'll produce on completion
- DB: insert a 2-winner Lush row with `prize_labels = ['Diamond Glow Facial', 'Hormone Labs']`; verify `SELECT prize_labels, prize_count FROM giveaway_partners …`.
- Visual: showcase card for the longest current prize ("$175 GIFT CARD", "DIAMOND GLOW FACIAL", "$100 GIFT CARD + …") renders the full text inside the box with no ellipsis at desktop + mobile widths.
- Cross-surface: PrizeShowcase shows two distinct cards for Lush ("DIAMOND GLOW FACIAL" / "HORMONE LABS"), DrawWinner's per-prize list shows the same two distinct sub-labels, admin PartnerCard badge lists both labels.
- Legacy: a partner with `prize_labels = NULL` and `prize_count > 1` still renders correctly (falls back to `prize_description` for every slot).

### Files touched
- migration: `ALTER TABLE giveaway_partners ADD COLUMN prize_labels jsonb;`
- `src/features/giveaway/hooks/useGiveawayPartners.ts`
- `src/features/giveaway/components/SettingsPanel.tsx` (PartnerForm + PartnerCard badge)
- `src/features/giveaway/components/PrizeShowcase.tsx` (text-fit + per-slot label)
- `src/features/giveaway/components/DrawWinner.tsx` (per-slot label)
