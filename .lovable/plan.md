# Wave 2 — Multi-Partner + Entry Fix + Brand Polish

## 1. Schema migration

- New table `giveaway_partners` (studio_slug, partner_name, partner_ig_handle, receipt_instructions, display_order, created_at). Public RLS: read for all, insert/update/delete public (matches existing giveaway pattern).
- `giveaway_entries`: add `partner_actions jsonb default '[]'`; change `base_entries` default `0`; recompute `total_entries` generated column = `base_entries + bonus_entries`.
- Drop `giveaway_studios.partner_name` and `partner_instructions`.
- Update Vestavia row: `studio_name = 'OTF Vestavia Hills'` (slug stays `vestavia`).

## 2. Constants — single source of truth

New `src/features/giveaway/lib/studioBrand.ts`:
```ts
export const STUDIO_IG: Record<string, { handle: string; display: string }> = {
  tuscaloosa: { handle: 'otftuscaloosa', display: '@otftuscaloosa' },
  auburn:     { handle: 'otfauburn',     display: '@otfauburn' },
  montgomery: { handle: 'otfmontgomery', display: '@otfmontgomery' },
  vestavia:   { handle: 'otfvestaviahills', display: '@otfvestaviahills' },
};
export const STUDIO_CITY: Record<string,string> = {
  tuscaloosa: 'TUSCALOOSA', auburn: 'AUBURN',
  montgomery: 'MONTGOMERY', vestavia: 'VESTAVIA HILLS',
};
```

## 3. Hooks

- New `useGiveawayPartners(slug)` — fetch ordered by `display_order`, expose `refresh`, `add`, `update`, `remove`.
- `useGiveawayStudio` — drop `partner_name`/`partner_instructions` from interface.

## 4. Admin Settings (`SettingsPanel.tsx`)

Replace the Partner block with **Partner Businesses** section:
- Header + subtext as specified.
- Card list of partners (name bold, @handle gray, truncated instructions, Edit / Delete with confirm).
- "Add Partner" orange full-width button → inline form (Name required, IG handle optional stored without `@`, Receipt Instructions textarea).
- Save → insert via hook, refresh, close form.
- Edit → same form pre-filled, "Update Partner".
- Delete → confirm dialog with exact copy from prompt.
All buttons 44px, visible borders, hover/active states, "Saved" inline 2s.

## 5. Participant Form (`GiveawayEntryPage.tsx`)

State changes:
- `base_entries = 0` everywhere. Total = bonus only.
- `igAccountChecks: Record<string, boolean>` — keyed by handle. Studio handle first, then partners in `display_order`.
- `action_instagram_follow` is derived: `true` only when every box in `igAccountChecks` is true.
- `partner_actions: { partner_id, completed, screenshot_url }[]` — one entry per partner, completed on successful screenshot upload.
- `bonusCount` = post_engagement + story_share + free_class + (ig follow all-checked ? 1 : 0) + completed partner_actions count.
- Max = `5 + partners.length`.
- Submit gated: requires name+email+phone AND `bonusCount >= 1` (per user answer). Helper text below button: "Complete at least one action to earn entries."

UI:
- Achievement #1 "Follow us on Instagram" — render checklist of all accounts, each row 44px with checkbox + handle + external link. Animated checkmark on check; reverts if any unchecked.
- Action #5..N — one card per partner: title "Visit [name]", optional `@handle` chip, description = instructions or fallback, ScreenshotUpload writes into `partner_actions[i]`.
- LiveEntryCounter shows `bonusCount` with label "of {5 + partners.length} possible".

Insert payload: `base_entries: 0`, `bonus_entries: bonusCount`, fixed action fields, `partner_actions` jsonb. Upload bucket path namespaced by `draftId/partner_<id>`.

## 6. Coming Soon screen

Replace block in `GiveawayEntryPage.tsx`:
- Full-bleed `#1C1C1E` with top + bottom 6px orange bars.
- Centered: ORANGETHEORY FITNESS eyebrow (orange, 11px, tracked), studio name 52px display, city 9px tracked light gray, 40px orange divider, "SOMETHING BIG IS COMING." 28px display, subline 14px gray, IG link 12px with Instagram icon.
- Bottom-right "More Life. More Energy. More You." 8px gray.
- Uses Big Shoulders Display + Jura via Google Fonts import in `index.html` (only added if not present). Applies to all 4 studio routes.

## 7. Admin Entries Table (`EntriesTable.tsx`)

- Actions column: 4 fixed checkmarks + N partner checkmarks (tooltip shows partner name; circle with initial).
- Expanded row: render fixed screenshots + map `partner_actions` to thumbnails labeled with partner name.

## 8. CSV export (`csvExport.ts`)

Columns: first_name, last_name, email, phone, total_entries, submitted_at, action_instagram_follow, action_post_engagement, action_story_share, action_free_class, then per partner: `partner_<slug>_completed`, `partner_<slug>_screenshot_url` (slug = lowercased partner name with non-alphanum → `_`). Fetch partners list to drive headers.

## 9. Draw + Spin Wheel

- `weightedDraw.ts`: filter `entries.filter(e => e.total_entries > 0)` before building ticket pool. (Likely already implicit but make explicit.)
- `SpinWheel` and `DrawWinner`: exclude `total_entries === 0` from selectable pool; show "Not eligible (0 entries)" badge in entries table for those.

## 10. Vestavia → Vestavia Hills

Grep for `Vestavia` across `src/features/giveaway/**` and update display strings only. Slug `vestavia` unchanged. Studio row updated via migration. `STUDIO_IG.vestavia.handle = 'otfvestaviahills'`.

## Coherence checks before done

- Counter on entry form, Confirmation total, CSV `total_entries`, Spin wheel ticket count → all match `bonus_entries` with `base=0`.
- Adding a partner in admin instantly appears as new action card + IG checkbox + "of X possible" label increments after refresh.
- Deleting a partner does not break old entries (partner_actions still readable; CSV header for that partner dropped — acceptable per scope).
- All 4 studio routes show branded Coming Soon when `goes_live_at` is null.
- Submit blocked with 0 actions; allowed at ≥1.
- Spin wheel + draw exclude 0-entry rows.

## Files touched

- supabase migration (new)
- `src/features/giveaway/lib/studioBrand.ts` (new)
- `src/features/giveaway/hooks/useGiveawayPartners.ts` (new)
- `src/features/giveaway/hooks/useGiveawayStudio.ts`
- `src/features/giveaway/GiveawayEntryPage.tsx`
- `src/features/giveaway/GiveawayAdminPage.tsx` (minor — pass partners to table)
- `src/features/giveaway/components/SettingsPanel.tsx`
- `src/features/giveaway/components/EntriesTable.tsx`
- `src/features/giveaway/components/LiveEntryCounter.tsx` (accept maxEntries prop)
- `src/features/giveaway/components/ConfirmationScreen.tsx` (verify uses passed total only)
- `src/features/giveaway/lib/csvExport.ts`
- `src/features/giveaway/lib/weightedDraw.ts`
- `index.html` (Google Fonts: Big Shoulders Display + Jura) if missing
