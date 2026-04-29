# Coach My Intros — Scripts Linking Fix

## Root Cause

On `/my-intros` (Coach My Intros), the "Send Text" button opens `ScriptSendDrawer` with:

```ts
categoryFilter={['follow-up', 'post-intro', 'no-show', 'missed-guest']}
```

Those slugs **do not exist** in the database. Real DB categories are:
`coach_followup`, `no_show`, `missed_guest`, `post_class_joined`, `promo`, etc.

Result: drawer renders "No scripts found for this category." Coaches cannot reach the scripts that already exist (`First Class — Didn't Buy`, `2nd Intro — Didn't Buy`).

Same root cause needs fixing in any other surface using non-canonical slugs. The SA Follow-Up tab dispatches `category: 'follow_up'` to `ScriptPickerSheet`, which has a `TAB_CATEGORY_MAP` that already aliases `follow_up` → `coach_followup`-adjacent categories — but `coach_followup` itself is NOT in that map's `follow_up` list, so the SA-side scripts also fail to surface.

## Database Changes (single migration)

1. **Confirm the 3 required scripts exist; insert/update by exact name (no duplicates):**
   - `After First Class` — category `coach_followup`
     - Body: `Hey {first-name}, Coach {first-intro-coach-name} here from OTF! You really stood out in your first class, you did so well! How are you feeling?`
   - `After 2nd Intro` — category `coach_followup`
     - Body: `Hey {first-name}, Coach {first-intro-coach-name} here from OTF! How did round 2 go for you?`
   - `April Deal` — category `promo`
     - Body: `Hey {first-name}, Coach {first-intro-coach-name} here from OTF! Randomly thought of you. We have a deal ending in the next couple days. $99 to get started and the heart rate monitor is on us. Didn't want you to miss it if timing ever felt off before. No pressure at all.`
   - All `is_active=true`, `channel='sms'`.
   - Use `INSERT ... ON CONFLICT (name) DO UPDATE` (or upsert via merge) so reruns don't duplicate.

2. **Deactivate or rename the old duplicates** (`First Class — Didn't Buy`, `2nd Intro — Didn't Buy`) by setting `is_active=false`, since the new canonical names replace them. CONFIRM THIS VALUE — keep both vs deactivate old? Default plan: deactivate old to avoid coach confusion.

3. **Ensure `Promotions` category exists** in `script_categories` (slug `promo`, name `Promotions`). Insert if missing.

## Code Changes

### A. New universal merge field `{first-intro-coach-name}`

Add to `src/lib/script-context.ts` and every other resolver. Resolution rule (run on script render anywhere):

1. Look up the booking's first-intro coach:
   - If `intros_booked.originating_booking_id` is set, traverse to the originator booking.
   - Otherwise this booking IS the first intro.
2. From that first-intro booking, prefer `intros_run.coach_name` (latest linked run); fall back to `intros_booked.coach_name`; fall back to empty string.
3. Strip TBD variants via existing `normalizeCoachName`.
4. Use first-name token for the merge field value.
5. **Coach-context override**: in `CoachMyIntros` and `CoachFollowUpList`, the logged-in coach IS the first-intro coach (they only see their own queue). When the resolver returns empty, fall back to the coach's own first name.
6. **Never** substitute `sa-name` for this field.

Add a helper `resolveFirstIntroCoachName(bookingId): Promise<string | null>` in `src/lib/script-context.ts`. Call it from `buildScriptContext`. Have `ScriptSendDrawer` and `MyDayScriptsTab` await it when `bookingId` is present and inject `first-intro-coach-name` into their merge maps.

Placeholder display when no person in context (Scripts tab browse mode): show `[Coach name]` for `{first-intro-coach-name}` and `[Member name]` for `{first-name}`. Never render raw `{...}` tags to end users.

### B. Fix the `categoryFilter` slug mismatch (root cause)

`src/pages/CoachMyIntros.tsx` line 777 — change from:
```ts
categoryFilter={['follow-up', 'post-intro', 'no-show', 'missed-guest']}
```
to the actual DB slugs:
```ts
categoryFilter={['coach_followup', 'no_show', 'missed_guest', 'post_class_joined']}
```
Default selected pill: `coach_followup` (Follow-Up) so the two prescribed scripts appear first.

`ScriptSendDrawer` — accept a new optional prop `defaultCategory` so the drawer pre-selects the Follow-Up pill on open instead of "All".

### C. SA Follow-Up tab pre-filter

`ScriptPickerSheet.TAB_CATEGORY_MAP.follow_up` — add `coach_followup` to the array so the prescribed Follow-Up scripts surface when SA taps Send Text from a follow-up card.

`MyDayPage` — when `scriptFromFollowUp` is true, ensure the suggested category list starts with `follow_up` (already does via FollowUpNeededTab dispatching `category: 'follow_up'`; verify event payload is honored as the active tab in the sheet).

### D. SA Scripts tab (`MyDayScriptsTab`) and Admin `Scripts` page

Both already render every active template grouped by `category` pill from `useScriptCategoryOptions`. The `Promotions` (`promo`) category will now contain `April Deal`. The `coach_followup` (or rename to `Follow-Up`) category will contain `After First Class` and `After 2nd Intro`.

CONFIRM THIS VALUE — should `coach_followup` category be renamed to display `Follow-Up`? The user prompt says category `Follow-Up` for Scripts 1/2. Default plan: update the `script_categories` row for slug `coach_followup` to set `name='Follow-Up'` (display label). Do NOT change the slug — that would break every existing template/filter.

Add `{first-intro-coach-name}` placeholder rendering to `MyDayScriptsTab.resolvePlaceholders` and `Scripts.tsx` template card preview so coaches/SAs see `[Coach name]` instead of raw tags.

### E. `script_send_log` already stores resolved body

`ScriptSendDrawer.handleCopy` already writes `message_body_sent: resolved`. Verify the same in `MyDayScriptsTab.handleCopy` (it does). No change needed beyond ensuring `{first-intro-coach-name}` is replaced before insert.

### F. Coach Follow-Up Page (separate from My Intros)

`CoachFollowUpList.tsx` is currently not rendered anywhere. CONFIRM THIS VALUE — does the user want it wired into a route, or is "Coach Follow-Up Page" a synonym for `/my-intros`? Default plan: treat `/my-intros` as the coach follow-up surface (matches the screenshot). Skip wiring `CoachFollowUpList` until clarified.

If user confirms `CoachFollowUpList` should be exposed, fix its dispatched event payload (`category: 'coach_followup'`) which is already correct, and ensure the page mounts the `ScriptPickerSheet` listener.

### G. Hide `April Deal` from coach surfaces

`CoachMyIntros` `categoryFilter` excludes `promo` (already does in fix B). Confirm the Coach scripts library (if any standalone view exists) also excludes `promo`. Currently coaches don't have a dedicated scripts library — only the Send Text drawer — so the filter exclusion is sufficient.

## Files Touched

- `supabase/migrations/<new>.sql` — upsert 3 templates, deactivate old duplicates, ensure `promo`/`Promotions` category, rename `coach_followup` display label to `Follow-Up`.
- `src/lib/script-context.ts` — add `resolveFirstIntroCoachName` + inject `first-intro-coach-name` merge field.
- `src/pages/CoachMyIntros.tsx` — fix `categoryFilter` slugs, pass `defaultCategory='coach_followup'`, pass coach context for merge field fallback.
- `src/components/scripts/ScriptSendDrawer.tsx` — add `defaultCategory` prop, resolve `{first-intro-coach-name}` in `resolveMergeFields` (await `resolveFirstIntroCoachName(bookingId)` on open), with coach-context fallback.
- `src/components/scripts/ScriptPickerSheet.tsx` — add `coach_followup` to `follow_up` tab map; resolve `{first-intro-coach-name}` in template body rendering.
- `src/features/myDay/MyDayScriptsTab.tsx` — placeholder display + (when bookingId present) real value.
- `src/features/myDay/MyDayPage.tsx` — pass `first-intro-coach-name` into `scriptMergeContext`.
- `src/components/dashboard/PipelineScriptPicker.tsx` — same merge-field addition for parity.
- `src/components/scripts/MergeFieldReference.tsx` — list new field.

## Subsequent Effects Implemented

1. `{first-intro-coach-name}` resolves identically across every surface (My Day Scripts, Send Script drawer, Pipeline picker, Coach My Intros, Admin Scripts page).
2. `script_send_log.message_body_sent` already stores the fully resolved text — verified in both copy handlers.
3. Scripts tab category bar shows `Promotions` (renamed from `Promos`) — `April Deal` is findable.
4. Old `First Class — Didn't Buy` / `2nd Intro — Didn't Buy` deactivated — no duplicate confusion.
5. Coach My Intros Send Text drawer now lists Follow-Up scripts (root-cause slug fix).
6. SA Follow-Up Send Text drawer surfaces the same Follow-Up scripts (TAB_CATEGORY_MAP fix).
7. `April Deal` hidden from coach surfaces via `categoryFilter` exclusion.

## Open Confirmations (will block implementation if not answered)

- Deactivate old `First Class — Didn't Buy` / `2nd Intro — Didn't Buy`, or keep both?
- Rename `coach_followup` category display name to `Follow-Up`?
- Is `/my-intros` the "Coach Follow-Up Page" referenced in the prompt, or is there a separate page that needs wiring?
