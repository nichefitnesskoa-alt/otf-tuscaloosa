
# Partner Deck — Mobile Layout Fixes

Scope: `src/features/giveaway/PartnerDeckPage.tsx` and `src/features/giveaway/components/FitText.tsx` only. Desktop unchanged. Giveaway entry form and admin untouched.

## 1. FitText: allow multi-line measurement

`FitText` currently forces `white-space: nowrap` and measures single-line `scrollWidth`. To support natural wrap on mobile while keeping desktop one-line behavior, add an opt-in `multiline` mode.

- New prop: `multiline?: boolean` (default `false`).
- When `false`: keep current behavior (nowrap, binary-search by width).
- When `true`: hidden measurer uses the actual container width with `white-space: normal`, `word-break: normal`; binary-search the largest size where `measure.scrollWidth <= containerWidth` (i.e. no word forces horizontal overflow — longest word/line fits). Visible span renders with `white-space: normal`, `display: block`, no nowrap.
- No change to `min`/`max`/`fixed`/`fillRatio` semantics.

## 2. Slide 1 (Cover) — remove "OTF", wrap title on mobile

In `SlideCover`:
- Delete the `<div>OTF</div>` placeholder above the "Partnership opportunity" label (line 155). Nothing replaces it.
- Render the two `FitText` headlines (`Cross-collab`, `orangeLine`) twice, gated by a CSS class. Cleanest pattern: render one set inside a `.deck-cover-desktop` wrapper and an alternate set inside `.deck-cover-mobile` wrapper, toggled via `<style>{`@media(max-width:768px){.deck-cover-desktop{display:none!important}} @media(min-width:769px){.deck-cover-mobile{display:none!important}}`}</style>`. (This matches the existing inline `<style>` pattern used in Slides 5/6.)
  - Desktop variant: unchanged — `multiline={false}`, `min/max` from `SIZES.s1_title1` / `SIZES.s1_title2`.
  - Mobile variant: `multiline`, with mobile-tuned bounds — title1 (`Cross-collab`): `min={28} max={72}`; title2 (orange partner line): `min={24} max={64}`. No `fixed` override applied on mobile (auto-size only, so it always fits).

## 3. Slide 3 (Prize) — stacked row on mobile

In `SlidePrize`, replace the single horizontal `<div>` for each row with two layouts driven by class names:
- Desktop (`.deck-prize-row-desktop`): unchanged — current flex layout including tag pill, title/description block, optional value, optional winner badge.
- Mobile (`.deck-prize-row-mobile`): stacked structure
  ```
  <div class="row">
    <div class="top">       <!-- flex, justify-content: space-between -->
      <span class="tag-pill" />        <!-- max-width: 60% -->
      <div class="right">              <!-- flex, gap 8 -->
        [winner badge]                 <!-- if framing.showWinnerBadgePerRow -->
        [value]                        <!-- if showValue -->
      </div>
    </div>
    <p class="title">{r.title}</p>
    {r.description && <p class="desc">{r.description}</p>}
  </div>
  ```
  - Row padding `14px 0`, border-bottom `1px solid C.boneDim08`, last row no border.
  - Title: 15px, weight 900, color `C.bone`.
  - Description: 12px, line-height 1.45, color `C.boneDim05Text`.
  - Value: 12px, weight 700, color `C.orange`, flex-shrink 0.
- Toggle desktop vs mobile variants via the existing `<style>` mediaquery technique (`@media(max-width:768px){.deck-prize-row-desktop{display:none!important}.deck-prize-row-mobile{display:flex!important;flex-direction:column}}` and inverse for `min-width:769px`).
- Footer line below rows: keep as-is (already wraps cleanly).

## 4. Slide 5 (Story) — full-width cards on mobile

Already correctly switches to `1fr` via `.deck-grid` rule. To remove dead space:
- On mobile, reduce slide horizontal padding to `20px` (Section 6) so the inner content area widens.
- Confirm card container has no extra horizontal padding (it doesn't — only the slide wrapper).
- Reduce mobile icon size: add `.deck-story-icon { width:32px; height:32px; }` and the lucide icon's `strokeWidth={2}` already fine; size change for the icon itself via inline conditional is awkward — instead add `<style>@media(max-width:768px){.deck-story-icon-wrap{width:32px!important;height:32px!important}}</style>`. Inner `<it.Icon size={15} />` left as-is; the surrounding 34→32 swap is sufficient per spec.

## 5. Slide 9 (CTA) — remove "OTF" placeholder

Per Fix 4 wording ("No logo, no 'OTF' text, no placeholder of any kind"), the giant translucent `OTF` on slide 9 (line 498) is also a placeholder. Remove that `<div>OTF</div>` block entirely. (If the user actually wanted to keep slide 9's faded OTF and only remove slide 1's, we'll back this out — flagging here for confirmation.)

## 6. Mobile spacing pass (single shared `<style>` block at top of `PartnerDeckPage`)

Inject one top-level `<style>` element inside the component's root `<div>` with `@media(max-width:768px)` rules so every slide picks up consistent mobile treatment without rewriting each inline `padding`. Targets:

```css
@media(max-width:768px){
  .deck-slide{ padding:32px 20px !important; }
  .deck-eyebrow{ font-size:9px !important; letter-spacing:0.18em !important; }
  .deck-body{ font-size:13px !important; max-width:none !important; }
  .deck-phase-title{ font-size:15px !important; }
  .deck-ask-card{ padding:14px !important; }
  .deck-ask-label{ font-size:9px !important; }
  .deck-ask-body{ font-size:12px !important; }
  .deck-nav{ right:12px !important; gap:6px !important; }
  .deck-nav a{ width:5px !important; height:5px !important; }
}
```

Add the corresponding class names to each slide's outer wrapper (`deck-slide`), eyebrows (`deck-eyebrow`), body copy paragraphs (`deck-body`), the nav `<nav>` (`deck-nav`), Slide 8 cards (`deck-ask-card` etc), and Slide 4 phase title `FitText` (`deck-phase-title`).

## 7. Verification

After build:
- Set preview viewport to mobile (375×812).
- Slide 1: title wraps cleanly, no "OTF" above eyebrow, no cutoff, no ellipsis.
- Slide 3: each prize row stacked (tag+value top, title/desc below); winner badges visible in per-prize modes.
- Slide 5: 4 cards single-column, full content width.
- Slide 9: no faded OTF behind headline.
- Nav dots tighter to right edge.
- Set preview viewport to desktop (1440×900) and confirm all slides render identically to current.

## Out of scope

- `PartnerDeckAdminPage.tsx`, `GiveawayEntryForm.tsx`, `PrizeShowcase.tsx`, `partnerDeckDefaults.ts`, `winnerCopy.ts`.
- Any DB schema change.
- Any desktop visual change.

## Confirmation needed

CONFIRM THIS VALUE: should the giant translucent "OTF" on Slide 9 (CTA) also be removed, or only the small "OTF" above the Slide 1 eyebrow? Plan currently removes both per the "no placeholder of any kind" wording — say the word and I'll keep Slide 9's intact.
