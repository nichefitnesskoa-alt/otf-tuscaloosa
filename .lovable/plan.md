## Finish Wave 4

Two small remaining items from the previous pass:

### 1. Fix broken build in `SettingsPanel.tsx`
Define and render `TitleFormatSection` inside `src/features/giveaway/components/SettingsPanel.tsx`:
- Three selectable cards bound to `title_format`:
  - `auto_combined` → preview "OTF [Studio] × [Partner] Giveaway"
  - `auto_studio_only` → preview "OTF [Studio] Giveaway"
  - `custom` → reveals a text input bound to `custom_title`
- Live preview line uses `getGiveawayTitle()` from `lib/giveawayTitle.ts`
- Save handler upserts `title_format` and `custom_title` together with existing studio fields (no field reset)

### 2. Add Preview nav entry in `GiveawayAdminPage.tsx`
- Desktop sidebar: add "Preview" item with Eye icon, links to `/admin/:studioSlug/preview`
- Mobile bottom tab bar: Entries | Preview | Settings (icons + short labels, no truncation)
- Active state highlights based on current route

### 3. Verify
- Build succeeds (no missing identifier)
- Preview route renders, "Go Live" dialog works
- Saving settings preserves `title_format`, `custom_title`, `winner_structure`, partner data
- Role visibility unchanged (Admin-only routes still gated)

No schema changes, no business-logic changes — UI + wiring only.
