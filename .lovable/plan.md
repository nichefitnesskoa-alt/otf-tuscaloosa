# Wave 4 — Typography, Co-Brand, Title Options, Live Preview, Responsive, Action Fix

## 1. Schema

Migration adds two columns to `giveaway_studios`:
- `title_format text not null default 'auto_combined'` with CHECK constraint (`'auto_combined' | 'auto_studio_only' | 'custom'`)
- `custom_title text` (nullable)

No data backfill required — existing rows default to `auto_combined`.

## 2. Typography system

**Load fonts** in `index.html`:
- `Big Shoulders Display` (700, 800, 900)
- `Barlow` (400, 500, 600)

**CSS variables** in `src/index.css` `:root`:
```
--font-display: 'Big Shoulders Display', 'Bebas Neue', Impact, sans-serif;
--font-body: 'Barlow', system-ui, sans-serif;
```

**Tailwind config** (`tailwind.config.ts`) — extend `fontFamily`:
```
display: ['Big Shoulders Display', 'Bebas Neue', 'Impact', 'sans-serif'],
body: ['Barlow', 'system-ui', 'sans-serif'],
```
Then use `font-display` / `font-body` utilities.

**Scope of replacement (giveaway feature only).** Per the project's design system rules, swapping app-wide fonts on internal staff pages (MyDay, Pipeline, Coach View, Wig, etc.) would change every screen in the studio app — well outside the brief, which is about the public giveaway. I'll apply the new typography across:
- `src/features/giveaway/**` (all components, pages, preview)
- The giveaway routes' wrapper (no global body font swap)

I'll grep `src/features/giveaway` for every `font-`, `fontFamily`, `Big Shoulders`, `Bebas`, `Jura` reference and replace with the unified system. If you want the typography applied to the internal staff app too, say so and I'll extend the scope.

## 3. Helpers

New `src/features/giveaway/lib/giveawayTitle.ts`:
- `getGiveawayTitle(studioName, partners, titleFormat, customTitle): string` — implements the rules with `×` separator.
- `getCoBrandLockup(studioName, partners): string` — returns `"Presented by OTF X + Y + Z"`.

## 4. Admin Settings — Title section

Edit `SettingsPanel.tsx`. Add `TitleFormatSection` at top using the same selectable-card pattern as `WinnerStructureSection`:
- Three cards, each with live preview built from current studio name + partners.
- Card 3 reveals `custom_title` input when selected.
- Local state `titleFormat`, `customTitle`; persisted in existing `saveSettings` upsert alongside `countdown_duration_days` and `winner_structure` (no field reset).

`useGiveawayStudio` and types: include `title_format`, `custom_title`.

## 5. Participant form rebuild

In `GiveawayEntryPage.tsx`:
- **Co-brand top bar** (#242426) with co-brand lockup, full-width.
- **Hero title** uses `getGiveawayTitle(...)` (replaces "WIN A FREE MEMBERSHIP"). Display font, OTF orange, responsive `clamp()`.
- **Subline** under title with co-brand lockup, off-white/light gray.
- **Page container**: `max-w-[1200px]`, `px-12 md:px-12 px-4`.

**`PrizeShowcase.tsx` rewrite**:
- Single equal-card grid for OTF + partners (no hierarchy labels).
- OTF card: `FREE MEMBERSHIP` / `ORANGETHEORY FITNESS {CITY}` / IG handle from `studioBrand`.
- Partner cards: `prize_description` (or `PRIZE TBD` gray) / `partner_name` / `@handle`.
- Desktop grid: `grid-template-columns: repeat(totalCards, minmax(0,1fr))`, `gap-3`, fixed 180px height.
- Mobile: `flex overflow-x-auto snap-x snap-mandatory`, 200px fixed width, 20px peek.
- Section header `WHAT YOU COULD WIN` — display, orange, tracked.
- Winner rule statement preserved below.

**Action cards grid** (desktop 2-col, mobile single-col):
- Wrap actions in `grid md:grid-cols-2 gap-4`.
- Instagram checklist (action 1), entry counter, submit → `md:col-span-2`.
- Apply display/body fonts to number badges, titles, descriptions, upload zone label, verified state per spec.

**Free class action (action 4) copy update**:
- Title: `Post a Class Story`
- Description: `Post a story of you taking a class and tag us. Upload a screenshot of your story.`
- Upload label: `Tap to upload story screenshot`
- Propagate to `csvExport.ts` header and `EntriesTable.tsx` tooltip; if `action_free_class` constant exists as a label, update there too.

## 6. Live Preview route

**Route**: `/admin/:studio_slug/preview` registered in the same place existing admin giveaway routes are declared (likely `src/App.tsx`; will verify and add for all four slugs via the existing `:studio_slug` pattern).

**New file** `src/features/giveaway/GiveawayPreviewPage.tsx`:
- Fixed top banner (44px, OTF orange) with title + Back to Admin + Go Live button (or `Giveaway is Live ✓` disabled state).
- Confirm dialog for Go Live (writes `goes_live_at = now()`).
- Desktop: device toggle (`Desktop | Mobile`); Mobile selected renders form inside a 390px centered phone frame.
- Renders `<GiveawayEntryForm previewMode />`.

**Refactor**: extract the participant form body from `GiveawayEntryPage.tsx` into a reusable `GiveawayEntryForm` component accepting `slug` and `previewMode`. In preview mode:
- Submit button label `ENTER NOW (Preview — submissions disabled)`; click → toast, no insert.
- Upload zones → toast on click, no upload.
- Reads same Supabase data (no separate source).

**Admin nav**: add Preview link (eye icon) between Settings and Entries in `GiveawayAdminPage.tsx`. Mobile admin nav becomes tab row `Entries | Preview | Settings`.

## 7. Coming Soon screen

Apply `getGiveawayTitle()` and co-brand lockup. Replace existing Jura/Big Shoulders inline font-family with `font-display` / `font-body` utilities.

## 8. Responsive specifics

Hero, countdown, entry form fields (2-col desktop / 1-col mobile), entry counter sizes, admin entries table → card list on mobile, all per spec using Tailwind `md:` prefixes.

## 9. Files

**New**
- `supabase/migrations/<ts>_giveaway_title_format.sql`
- `src/features/giveaway/lib/giveawayTitle.ts`
- `src/features/giveaway/components/GiveawayEntryForm.tsx` (extracted)
- `src/features/giveaway/GiveawayPreviewPage.tsx`

**Edited**
- `index.html` (Google Fonts)
- `src/index.css` (font vars)
- `tailwind.config.ts` (font families)
- `src/App.tsx` (preview route)
- `src/features/giveaway/GiveawayEntryPage.tsx` (uses extracted form + new title/header)
- `src/features/giveaway/GiveawayAdminPage.tsx` (nav: Preview link, mobile tabs)
- `src/features/giveaway/components/SettingsPanel.tsx` (TitleFormatSection + save)
- `src/features/giveaway/components/PrizeShowcase.tsx` (full redesign)
- `src/features/giveaway/components/LiveEntryCounter.tsx` (typography + sizing)
- `src/features/giveaway/components/Countdown.tsx` (typography + sizing)
- `src/features/giveaway/components/EntriesTable.tsx` (mobile cards + action 4 label + typography)
- `src/features/giveaway/components/ScreenshotUpload.tsx` (typography, preview-disabled support)
- `src/features/giveaway/hooks/useGiveawayStudio.ts` (new fields)
- `src/features/giveaway/lib/csvExport.ts` (action 4 header)
- `src/integrations/supabase/types.ts` (auto via migration)

## 10. Verification

- Grep `src/features/giveaway` for stray font references after refactor.
- Manually open `/g/tuscaloosa` and `/admin/tuscaloosa/preview` (desktop + mobile viewports).
- Confirm Save Settings preserves all four field groups (countdown, winner_structure, title_format, custom_title).
- Confirm preview submit + upload are no-ops with toasts.

## Question before I build

**Typography scope**: confirm I should apply Big Shoulders/Barlow only inside the public giveaway feature (recommended — touching the internal staff app fonts is a much bigger change with risk to MyDay/Coach/Pipeline UIs). If you want it app-wide, I'll extend scope.
