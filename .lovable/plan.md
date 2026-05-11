## Goal

Tighten the "Today's Shift" card on My Day, fix the task → standard groupings, rename a standard, and make every part of this section (standards + tasks + groupings) editable from Admin.

## UI changes — `src/features/myDay/ShiftChecklist.tsx`

1. **Delete the 3-question reflection header** at the top (`ShiftReflectionHeader` component + its render). The same three questions still live at the bottom in `EndOfShiftSubmission`, so nothing is lost.
2. **Make the entire orange "Today's Shift" card collapsible**, default **collapsed**.
   - Header bar (orange `Today's Shift — Mon May 11`) becomes a clickable toggle with a chevron.
   - Right side of header shows compact summary: `X of 5 standards complete`.
   - Body (5 standard cards + end-of-shift submission) is hidden until expanded. State persists in `sessionStorage` under key `myday_shift_card_open` so it doesn't auto-collapse on every re-render.

## Data / mapping fixes

3. **Standard s2 rename**: "Every lead interaction is real. Not a script sent. A conversation started." → **"Every lead interaction feels real and genuine."**
4. **Task → standard fixes**, so the three tasks Koa called out land in the right card:
   - `Name on whiteboard before intros arrive` → s1
   - `Booking confirmation and questionnaire sent for today` → s1
   - `Comment genuinely on posts on feed or people we follow today` → s2
   
   These currently fall into "Other" because `TASK_STANDARD_MAP` keys don't match the seeded `task_name` strings (the seed and the map drifted apart in the last build).

## Admin editability — make standards + groupings DB-driven

Right now `STANDARDS` and `TASK_STANDARD_MAP` are hardcoded in `src/features/shiftView/standards.ts`. To let Koa edit "every part of this section" from Admin, move them to the database.

### Migration

- New table **`shift_standards`**:
  - `key` (text, primary key) — e.g. `s1`, `s2`, `s3`, `s4`, `s5`, `other`
  - `title` (text)
  - `display_order` (int)
  - `is_active` (bool, default true)
  - `created_by`, `created_at`, `updated_at`
  - RLS: same public-read / staff-write pattern as `shift_task_templates`
- Seed the 6 current standards (with the s2 rename applied).
- Add column **`standard_key`** (text, nullable, default `'other'`) on `shift_task_templates`. Backfill every existing `'standard'` template by matching `task_name` against the corrected mapping above. Anything unmatched stays `'other'`.
- Add same `standard_key` column on `shift_task_overrides` so today-only tasks can also be slotted into a standard.

### `src/features/shiftView/standards.ts`

- Keep `StandardKey` type and `REFERRAL_ASK_TASK_NAME` constant (the referral row is still a special-case render, not generic).
- Replace hardcoded `STANDARDS` and `TASK_STANDARD_MAP` with a small React Query hook `useShiftStandards()` that fetches from `shift_standards` (cached, realtime-friendly). Provide a synchronous fallback list used only while the query is loading so first paint isn't blank.
- `standardForTask` becomes `standardForTask(template)` — reads `template.standard_key` directly. No more name-string lookup, so renaming a task no longer breaks its grouping.

### `ShiftChecklist.tsx` and `ShiftTaskList.tsx`

- Pull `STANDARDS` from the hook.
- Read `standard_key` from each template / override row when building `TaskRow` instead of doing a name lookup.

### Admin — `src/components/admin/ShiftTasksAdmin.tsx`

- Add a **third tab "Standards"** alongside Shift Tasks / Today-Only Tasks. Inside: list of the 5 standards (+ Other) with inline edit of `title`, drag-free up/down reorder buttons (matching the existing task UX), active toggle, and "Add standard" form. `key` is set automatically (`s6`, `s7`…) when adding new ones.
- In the existing Shift Tasks editor, add a **Standard** dropdown (populated from `shift_standards`) on each task row and on the Add-task form. Saving updates `standard_key` on the template.
- Same standard dropdown added to the Today-Only override form.
- Drop the old morning/mid/last/weekend tabs in this admin (they're orphaned now that everything runs on `shift_type = 'standard'`); show a single flat list of `'standard'` templates instead. Old historic templates stay untouched in the DB.

## Coherence checks

- Open My Day as an SA: the orange Today's Shift card is collapsed by default and shows "0 of 5 standards complete." Expanding it reveals the 5 cards (no 3-question header). The three renamed/re-grouped tasks render under s1 and s2 respectively. s2 title reads the new wording. End-of-shift submission still works.
- Open Admin → Shift Tasks → Standards: rename s3, save, return to My Day → the standard renders with the new name without a code change. Reassign a task to a different standard from the dropdown → it moves cards on next load. Mark a standard inactive → its card disappears from My Day.
- Existing `shift_task_completions` rows continue to load (we only add columns, never remove or rename).

## Files touched

- `supabase/migrations/<new>.sql` — `shift_standards` table + seed, `standard_key` column on `shift_task_templates` and `shift_task_overrides`, backfill, RLS.
- `src/features/shiftView/standards.ts` — replace constants with `useShiftStandards` hook + simpler `standardForTask`.
- `src/features/myDay/ShiftChecklist.tsx` — delete reflection header, wrap card in collapsible (default closed), use hook.
- `src/features/shiftView/ShiftTaskList.tsx` — use hook + `standard_key`.
- `src/components/admin/ShiftTasksAdmin.tsx` — add Standards tab, standard dropdown on each task row and Add form, collapse to single `'standard'` list.

## Open question

None — I have what I need. If you'd rather keep the orange card always-expanded and only collapse the 5 standard cards individually, say the word and I'll swap that piece.
