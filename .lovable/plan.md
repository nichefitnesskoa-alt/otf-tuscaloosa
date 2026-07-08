## Goal
Make member-name entry in the SOML Log dialogs (Upgrade shown, plus the sibling Referral/Save inputs) pull from the outreach lists as a searchable dropdown, and display outreach names as "First Last" instead of "Last, First".

## Changes

### 1. Shared name helper — `src/lib/outreachNames.ts` (new)
- `formatOutreachName(raw)`: if value contains a comma, split on first comma, trim, return `"First Last"`. Otherwise return as-is. Handles suffixes like "Henderson Jr., C Dewayne" → "C Dewayne Henderson Jr.".
- Used everywhere outreach `client_name` is displayed.

### 2. Outreach list display — first name first
- `src/pages/OutreachListDetail.tsx`, `src/pages/OutreachLists.tsx`, and any row-list surface: render `formatOutreachName(row.client_name)` instead of raw `client_name`.
- Underlying DB value stays `"Last, First"` (that's how the CSV imports arrive and how sort order works). Display-only swap. Search inputs on those pages will match against both raw and formatted forms.

### 3. New hook — `src/hooks/useOutreachNames.ts`
- Selects `client_name` from `outreach_list_rows` across all lists (dedup, case-insensitive), returns array of `{ raw, display }` where `display = formatOutreachName(raw)`.
- React Query, cached ~5 min, invalidated on outreach mutations.

### 4. `src/features/soml/LogSomlDialog.tsx`
Replace the plain text `<Input>` for member name in all three sub-forms (Upgrade, Save/Manual, Referral — both "referring member" and "new lead" fields) with a Combobox:
- Type-ahead search over `useOutreachNames()` results (display form).
- Selecting an option fills the input with the display value ("First Last").
- Free typing is still allowed for names not in any outreach list.
- Small helper text under the field: *"We'll try to match a name from your outreach lists first — you can also type one in."*
- On submit, save the display-form name (First Last) into `member_name` / `referring_member_name` so it matches how it now shows in the outreach UI. This keeps drilldown labels consistent.

### 5. Coherence
- Duplicate-prevention unique index on `soml_upgrades(lower(btrim(member_name)))` and `soml_manual_referrals(lower(btrim(member_name)))` already exists — swapping the stored format from "Last, First" to "First Last" doesn't break it (still one canonical form going forward). Existing rows are unaffected; new inserts use the new form.
- Outreach referral badge lookup on `OutreachListDetail` currently matches by `member_name` / `referring_member_name` against outreach `client_name`. That match will be updated to compare using `formatOutreachName(...)` on both sides so old ("Last, First") and new ("First Last") rows both count.

## Out of scope
- Not touching the CSV import format or renaming stored `client_name` in the DB.
- No changes to the upgrade tier ("Premier"/"Elite") buttons.

## Files touched
- `src/lib/outreachNames.ts` (new)
- `src/hooks/useOutreachNames.ts` (new)
- `src/features/soml/LogSomlDialog.tsx`
- `src/features/wig/soml/SomlSection.tsx` (referral-badge match uses formatter)
- `src/pages/OutreachListDetail.tsx`
- `src/pages/OutreachLists.tsx`
