# Prize Display + Winner Copy — Wired to Winner Structure

## Goal

Make `winner_structure` from `giveaway_studios` the single source of truth that drives:
1. Partner deck slide 2 (headline + body)
2. Partner deck slide 3 (prize rows + footer line)
3. Participant entry form prize section (banner + per-card winner badge + rule statement)

Inline editor placeholders + helper text update with the active winner structure. Manual overrides on slide 2 still win.

## Files in scope

- `src/features/giveaway/lib/winnerCopy.ts` (new, single source of truth)
- `src/features/giveaway/PartnerDeckPage.tsx` (slide 2 + slide 3)
- `src/features/giveaway/PartnerDeckAdminPage.tsx` (slide 2 placeholders + helper text)
- `src/features/giveaway/components/GiveawayEntryForm.tsx` (banner + rule statement)
- `src/features/giveaway/components/PrizeShowcase.tsx` (per-card "1 WINNER" badge in per-prize modes)
- `src/features/giveaway/lib/partnerDeckDefaults.ts` (re-export from winnerCopy.ts for back-compat; remove duplicated SLIDE2_AUTO_COPY content)

Nothing else is touched. Giveaway admin (entries, draw, wheel) is not opened.

## 1. New helper: `src/features/giveaway/lib/winnerCopy.ts`

Three exported functions, plus a typed `WinnerStructure` re-export.

```ts
export function getDeckSlide2(ws, headlineOverride?, bodyOverride?) {
  // returns { headline, body }
  // headline: 'single' => 'One big prize. Every brand wins.'
  //          per_prize_* => 'One big giveaway. Every business wins.'
  // body: three full strings exactly as specified in prompt
  // overrides (non-empty trimmed) win per field
}

export function getDeckSlide3Framing(ws) {
  // returns { headline, bundleSubtext, showWinnerBadgePerRow, footerLine, footerStyle: 'brand'|'muted' }
  // single:
  //   headline: 'One bundle, built together.'
  //   bundleSubtext: 'One winner takes everything.'
  //   showWinnerBadgePerRow: false
  //   footerLine: 'Everything goes to one winner.'
  //   footerStyle: 'brand' (orange, italic, 12px)
  // per_prize_with_removal:
  //   headline: 'One prize each. Every business represented.'
  //   bundleSubtext: "Separate winner for each prize. Winners can't win twice."
  //   showWinnerBadgePerRow: true
  //   footerLine: "Each prize goes to a different winner. Once you win, you're out of the pool."
  //   footerStyle: 'muted'
  // per_prize_allow_repeat:
  //   headline: 'One prize each. Every business represented.'
  //   bundleSubtext: 'Separate winner for each prize. Same person can win more than once.'
  //   showWinnerBadgePerRow: true
  //   footerLine: 'Each prize goes to its own winner. The same person could win more than once.'
  //   footerStyle: 'muted'
}

export function getEntryFormPrizeFraming(ws) {
  // returns { showWinnerBadgeOnCards, bannerText, winnerRuleStatement }
  // single:
  //   showWinnerBadgeOnCards: false
  //   bannerText: 'One winner takes the whole bundle.'
  //   winnerRuleStatement: 'One winner will be drawn to receive all prizes.'
  // per_prize_with_removal:
  //   showWinnerBadgeOnCards: true
  //   bannerText: 'Every prize has its own winner.'
  //   winnerRuleStatement: "One winner drawn per prize. Win once and you're out of the pool for the remaining draws."
  // per_prize_allow_repeat:
  //   showWinnerBadgeOnCards: true
  //   bannerText: 'Every prize has its own winner.'
  //   winnerRuleStatement: 'One winner drawn per prize. The same person can win more than once.'
}
```

`partnerDeckDefaults.ts`: replace `SLIDE2_AUTO_COPY` and `slide2AutoCopy` with thin re-exports calling into `winnerCopy.ts` so older imports keep working without duplicating strings.

## 2. `PartnerDeckPage.tsx`

### SlideConcept (slide 2)
- Replace `pick(studio.deck_s2_headline, DEFAULT_DECK.s2_headline)` and `pick(studio.deck_s2_body ?? deck_intro_copy, autoBody)` with:
  ```
  const { headline, body } = getDeckSlide2(studio.winner_structure, studio.deck_s2_headline, studio.deck_s2_body ?? studio.deck_intro_copy);
  ```
- Render `headline` (split-by-sentence FitText) and `body` exactly as today.

### SlidePrize (slide 3)
- Compute `const f = getDeckSlide3Framing(studio.winner_structure)`.
- Use `pick(studio.deck_s3_headline, f.headline)` so manual headline override still works (per prompt: only headline can be overridden on slide 3).
- Render `f.bundleSubtext` as a new line below the value-note (always auto, no override).
- For each row: when `f.showWinnerBadgePerRow`, render a `1 WINNER` badge on the right (replaces the `$value` on partner rows; OTF row keeps `$value` AND adds the badge per spec).
- Below last row: render `f.footerLine` with `f.footerStyle` (brand: `color: C.orange, italic, 12px, marginTop:12`; muted: `color: C.gray, italic, 12px, marginTop:12`).
- Badge styling per spec: 9px, uppercase, letter-spacing wide, padding `2px 6px`, border-radius 2, `bg: C.boneDim08`, `color: C.gray`, `border: 1px solid C.boneDim15`.

## 3. `PartnerDeckAdminPage.tsx`

Slide 2 section only:
- Headline field placeholder uses `getDeckSlide2(ws).headline` (no overrides passed).
- Body field placeholder uses `getDeckSlide2(ws).body`.
- Add `helper` prop (or inline `<p>`) under each input: `"Auto-generates based on your Winner Draw Rules selection."` styled `text-[#8E8E93] text-[11px] italic mt-1`.
- If `SavedInput`/`SavedTextarea` don't accept a helper prop, add a small `helperText` prop in those local components.

No other admin sections change.

## 4. `GiveawayEntryForm.tsx`

After `<PrizeShowcase>`:
- Compute `const ef = getEntryFormPrizeFraming(studio.winner_structure ?? 'single')`.
- Render a new full-width banner: `bg-[#E8540A]/15 border border-[#E8540A] rounded text-[#E8540A] font-display font-bold text-[14px] text-center px-4 py-2.5` with `ef.bannerText`.
- Replace the existing `getDrawRuleStatement(...)` line with `ef.winnerRuleStatement` (same italic muted styling). Keeps one source of truth for entry-form rule text.
- Pass `showWinnerBadge={ef.showWinnerBadgeOnCards}` down to `<PrizeShowcase>`.

## 5. `PrizeShowcase.tsx`

- Accept new optional prop `showWinnerBadge?: boolean`.
- Inside `PrizeCard`, when `showWinnerBadge` is true, render an absolutely-positioned `1 WINNER` badge in bottom-right of the card (8px uppercase, tracked, `bg-[#2A2A2C] text-[#8E8E93] border border-[#3a3a3c] rounded-[2px] px-1.5 py-0.5`).
- No other layout changes.

## Verification (post-build)

Run through the 5-step flow from the prompt against the live preview, switching `winner_structure` in the inline editor and confirming each surface updates. Confirm manual `deck_s2_headline` / `deck_s2_body` overrides still win and clearing them restores auto-copy. Confirm `deck_s3_headline` override still wins. Confirm bundleSubtext + footer line on slide 3 are NOT user-overridable (always auto). Confirm no hardcoded winner-dependent strings remain in the three surfaces.

## Out of scope

- Giveaway admin (entries, draw, wheel)
- Any file not listed above
- DB schema (no migration required — all driven from existing `winner_structure`)
