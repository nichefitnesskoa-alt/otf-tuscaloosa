
# Fix: Script Picker — Auto-Pull Questionnaire Data + Script Creation Restoration

## What's Broken Today

1. Script button on MyDay cards opens ScriptPickerSheet with zero member context — no goal, no obstacle, no why displayed anywhere in the sheet.
2. Pipeline row cards have no Script button at all. `PipelineScriptPicker` exists as a component but is never triggered from the row.
3. ScriptPickerSheet does not load or display questionnaire data for the booking.
4. Script creation is unreachable — the `/scripts` page exists with full admin Create/Edit/Delete, but it is not linked from Admin, not in the bottom nav, and not discoverable.
5. `IntroBookingEntry.tsx` opens ScriptPickerSheet with `bookingId={undefined}`, meaning copy-on-send logging is unlinked from the booking.

---

## Part 1: ScriptPickerSheet — Add Member Context Panel

**File:** `src/components/scripts/ScriptPickerSheet.tsx`

When `bookingId` is provided, the sheet will:

1. Fetch the `intros_booked` row for that booking (to get `member_name`, `lead_source`, `originating_booking_id`).
2. Fetch the matching `intro_questionnaires` row by `booking_id`.
3. Display a compact, non-collapsible **MEMBER CONTEXT** section at the top of the drawer, before the script list.

**Context section layout:**
```text
MEMBER CONTEXT
Name:     Sarah T.
Goal:     Ask before class         ← if no Q
Obstacle: Ask before class
Why:      Ask before class
```
If questionnaire data exists:
- Goal = `q1_fitness_goal` (trimmed to ~40 chars)
- Obstacle = `q3_obstacle` (trimmed)
- Why = `q5_emotional_driver` (trimmed)

If booking exists but no questionnaire: show "Ask before class" for all three.

If `bookingId` is absent (admin script editing path): show no context panel — existing behavior preserved exactly.

**New props added to ScriptPickerSheet:**
- None new — `bookingId` already exists as optional prop. The component will self-fetch when bookingId is present.

**State changes inside ScriptPickerSheet:**
```typescript
const [memberCtx, setMemberCtx] = useState<{
  name: string;
  goal: string | null;
  obstacle: string | null;
  why: string | null;
} | null>(null);
```
Fetch fires in `useEffect([open, bookingId])`.

---

## Part 2: Pipeline — Add Script Button to PipelineRowCard

**File:** `src/features/pipeline/components/PipelineRowCard.tsx`

Add a **Script** button to the action buttons section at the bottom of the expanded card content (the `pt-2 border-t` div).

The button opens `PipelineScriptPicker` with the current `journey`. `PipelineScriptPicker` already exists and already builds the full merge context + loads questionnaire links — it just needs to be wired into the row card.

**Changes:**
- Add `import { PipelineScriptPicker } from '@/components/dashboard/PipelineScriptPicker'`
- Add `scriptOpen` state
- Add `<Button>Script</Button>` next to "Add Intro Run" in the action buttons row
- Render `<PipelineScriptPicker>` conditionally

Because `PipelineScriptPicker` wraps `ScriptPickerSheet`, the new member context panel from Part 1 will automatically appear for Pipeline scripts too (the `bookingId` is already threaded through).

---

## Part 3: Fix IntroBookingEntry.tsx — Pass bookingId

**File:** `src/components/IntroBookingEntry.tsx`

Line ~577: `bookingId={undefined}` → change to `bookingId={booking.id}` (the booking's actual ID).

This ensures that when an SA copies a script from the booking entry view, the `script_actions` log is correctly linked to the booking.

---

## Part 4: Restore Script Creation Discoverability

The `/scripts` page already has full create/edit/delete for admins via `TemplateEditor`. The problem is no navigation surface leads there.

**Fix:** Add a **Scripts tab** to the Admin page (`src/pages/Admin.tsx`).

- Add a new tab with `value="scripts"` to the existing 6-column `TabsList`
- Render the `Scripts` page content inline (or import the Scripts page component into the tab content)
- Alternatively, add a nav card in the Admin Overview that links to `/scripts`

The cleaner approach (minimal change, no restructuring): Add a "Scripts" tab to Admin that embeds the existing `Scripts` page content (already a standalone component — just import and render it).

Admin `TabsList` currently `grid-cols-6` → change to `grid-cols-7` and add the Scripts tab.

**Files:** `src/pages/Admin.tsx`

---

## Part 5: Script Filtering by Lead Source and Intro Type

When `bookingId` is provided and the booking is loaded, use the fetched booking data to also set `suggestedCategories` intelligently based on lead source and intro type:

- **2nd intro** (`originating_booking_id` not null): prefer `['post_class_no_close', 'follow_up']` categories
- **Walk-In** lead source: prefer `['confirmation', 'questionnaire']`  
- **Web Lead**: prefer `['confirmation', 'questionnaire']`
- **Referral**: prefer `['confirmation', 'questionnaire']`
- **Instagram**: prefer `['outreach', 'confirmation']`

This restores the lead-source-aware filtering that was described as "previously working."

Currently MyDay hardcodes `suggestedCategories={['confirmation', 'questionnaire', 'follow_up']}`. After this fix, categories are derived from the booking data loaded inside ScriptPickerSheet — or passed down by the parent.

The cleanest approach: keep `suggestedCategories` as a prop from the parent (don't change the prop interface) but allow `ScriptPickerSheet` to **override** the initial selected tab based on the fetched booking context. That way the parent's `suggestedCategories` still controls what tabs appear, but the default-selected tab can be set intelligently.

---

## Technical Implementation Order

```text
1. ScriptPickerSheet.tsx    — add useEffect fetch + member context panel display
2. PipelineRowCard.tsx      — add Script button + PipelineScriptPicker wiring
3. IntroBookingEntry.tsx    — fix bookingId={undefined} → bookingId={booking.id}
4. Admin.tsx                — add Scripts tab (7th column)
```

## Files Changed

| File | Change |
|---|---|
| `src/components/scripts/ScriptPickerSheet.tsx` | Add member context fetch + display panel |
| `src/features/pipeline/components/PipelineRowCard.tsx` | Add Script button + PipelineScriptPicker |
| `src/components/IntroBookingEntry.tsx` | Fix bookingId pass |
| `src/pages/Admin.tsx` | Add Scripts management tab |

## What Is NOT Changed

- MessageGenerator — no changes
- TemplateEditor — no changes (already works)
- MyDay event flow (myday:open-script dispatch) — no changes
- ScriptPickerSheet category tab logic — no changes
- Pipeline dialogs — no changes
- FollowUpQueue script opener — already passes bookingId correctly, no change
- LeadDetailSheet script opener — already passes leadId correctly, no change (no bookingId available there by design since it's a lead-level view)

## Acceptance Checklist Coverage

- Click Script on MyDay intro card (member with Q) → name/goal/obstacle/why shown at top of sheet automatically
- Click Script on walk-in (no Q) → "Ask before class" shown for all three fields, no crash
- Open Scripts from Admin tab → create/edit/delete all work
- Pipeline expanded card shows Script button → clicks opens PipelineScriptPicker with member context
- IntroBookingEntry script log now linked to correct booking ID
