## Wave 5 — Brand Name + Title Cleanup

### 1. Create `src/lib/studioNames.ts` (new file)
Single source of truth for studio display names. Exports:
- `getParticipantStudioName(slug)` → "OrangeTheory Fitness Tuscaloosa" etc.
- `getParticipantBrandName()` → "OrangeTheory Fitness" (no city, used in titles)
- `getAdminStudioName(slug)` → "OTF Tuscaloosa" etc.
- `getStudioCity(slug)` → "Tuscaloosa", "Vestavia Hills", etc.
- `getStudioIgHandle(slug)` → "@otftuscaloosa" etc.

Slug map covers tuscaloosa / auburn / montgomery / vestavia. Unknown slug falls back to "OrangeTheory Fitness" / "OTF" with a humanized city.

### 2. Update `src/features/giveaway/lib/giveawayTitle.ts`
- `getGiveawayTitle(slug, partners, titleFormat, customTitle)` — signature changes from `studioName` to `slug`.
  - `auto_combined` + partners: `OrangeTheory Fitness × P1 × P2 Giveaway`
  - `auto_combined` no partners: `OrangeTheory Fitness Giveaway`
  - `auto_studio_only`: `OrangeTheory Fitness Giveaway`
  - `custom` with text: returned verbatim
  - Fallback: `OrangeTheory Fitness Giveaway`
  - Internally uses `getParticipantBrandName()` only — never city.
- `getCoBrandParts(slug, partners)` — uses `getParticipantStudioName(slug)` so the first chip is "OrangeTheory Fitness Tuscaloosa".

### 3. Retire `src/features/giveaway/lib/studioBrand.ts`
Replace all imports of `getStudioIg` / `getStudioCity` with the equivalents from `src/lib/studioNames.ts`. `getStudioIg` returned `{handle, display}`; consumers will be updated to use `getStudioIgHandle()` (single "@handle" string) directly. Delete the file after migration.

### 4. Update consumers (participant-facing)
- `GiveawayEntryForm.tsx`
  - Hero title: `getGiveawayTitle(slug, partners, ...)` (pass slug, not studio_name).
  - Co-brand lockup: `getCoBrandParts(slug, partners)` → "Presented by OrangeTheory Fitness Tuscaloosa + Hemline + PJ's Coffee".
  - Studio badge top-right: `getStudioCity(slug)` uppercased (unchanged behavior).
  - Action 1 Instagram description: `Follow ${getParticipantStudioName(slug)} on Instagram (${getStudioIgHandle(slug)})`.
  - Pass `slug` to `ComingSoonScreen` (drop `studioName` prop).
- `ComingSoonScreen` (inside `GiveawayEntryForm.tsx`)
  - Primary: "OrangeTheory Fitness" (display font, off-white).
  - City line below: `getStudioCity(slug)` (smaller, tracked).
  - Subhead: "A giveaway you won't want to miss is on the way."
  - IG link: `getStudioIgHandle(slug)` in OTF orange, links to `https://instagram.com/<handle without @>`.
- `PrizeShowcase.tsx` — OTF prize card business name: `getParticipantStudioName(slug).toUpperCase()`. IG line: `getStudioIgHandle(slug)`.
- `SpinWheel.tsx` and `DrawWinner.tsx` — membership prize label: `${getParticipantStudioName(slug)} Membership` (replaces "OTF Membership — City"). These are admin draw tools but the label is shown on the wheel/result and reads cleaner with full brand.
- `winnerStructure.ts` — subtitle copy: "One person wins the OrangeTheory Fitness membership and all partner prizes."

### 5. Update consumers (admin-facing) — keep shorthand
- `GiveawayAdminPage.tsx` sidebar / headers / preview banner: `getAdminStudioName(studio.studio_slug)` instead of `studio.studio_name`.
- `SettingsPanel.tsx` `TitleFormatSection`
  - Pass `slug` instead of `studioName` into `getGiveawayTitle()`.
  - Card 1 label: "Auto: Studio + Partners" — subtext "Updates automatically as you add or remove partners." Preview rebuilt live from current partner state.
  - Card 2 label: "Auto: Brand Only" — subtext "Clean and simple." Preview: "OrangeTheory Fitness Giveaway".
  - Card 3 label: "Custom Title" — input label "Custom giveaway title", placeholder "e.g. Tuscaloosa Summer Giveaway", helper "Shown exactly as typed on the entry form."
  - Save handler unchanged — already upserts `title_format` and `custom_title` alongside `countdown_duration_days` and `winner_structure` in a single update. Verify no field is dropped.

### 6. Preview page
- `GiveawayPreviewPage.tsx` renders `GiveawayEntryForm` with `previewMode`; no direct changes needed once the form uses slug-based helpers. Spot-check that admin banner uses `getAdminStudioName`.

### 7. Verification checklist (manual)
- Participant entry form: title has no city, co-brand bar has city, badge has city, IG action mentions city + handle.
- Coming Soon: "OrangeTheory Fitness" big, city below, IG link works.
- Preview route mirrors live form.
- Admin sidebar/header still reads "OTF Tuscaloosa".
- Settings: changing partners updates Card 1 preview live; saving settings preserves winner_structure, duration, partners.
- All four slugs (tuscaloosa, auburn, montgomery, vestavia) resolve in every helper.
- `rg "OTF " src/features/giveaway` shows zero hits on participant-facing strings (admin shorthand only).

### Files touched
- new: `src/lib/studioNames.ts`
- edit: `src/features/giveaway/lib/giveawayTitle.ts`
- delete: `src/features/giveaway/lib/studioBrand.ts`
- edit: `GiveawayAdminPage.tsx`, `GiveawayEntryForm.tsx`, `PrizeShowcase.tsx`, `SpinWheel.tsx`, `DrawWinner.tsx`, `SettingsPanel.tsx`, `winnerStructure.ts`

No schema, data, or business-logic changes.
