

# Coach View Card Overhaul — Plan

## Summary
Six changes: orange shoutout consent bar (both views), remove stale sections, make Zone 2 editable in Coach View, add post-class debrief with new DB column, update print card, update WIG coach metrics.

## Database Migration
Add one column to `intros_booked`:
```sql
ALTER TABLE public.intros_booked ADD COLUMN IF NOT EXISTS coach_member_pair_plan text;
```

No view updates needed since `coach_wig_summary` is a materialized/regular view — will need to be recreated to include `planned_pairing_rate`.

## File Changes

### 1. `src/components/shared/TheirStory.tsx`
**Shoutout consent bar (FIX 1):** Replace the current bordered toggle (lines 225-242) with a full-width orange bar visible in BOTH SA and Coach views (remove the `!readOnly` guard). Bar shows "Shoutout: YES" / "Shoutout: NO" / "Shoutout: Not asked yet" in white bold on orange (#E8540A) / amber background. Tapping toggles the value. Remove the Switch component for consent.

**Zone 2 editable in Coach View (FIX 3):** Remove the `readOnly` conditional rendering on Zone 2 fields (lines 289-304, 315-330, 348-365). Instead, always render the editable Textarea inputs regardless of `readOnly`. The `readOnly` prop still controls realtime subscription behavior but no longer hides inputs. Pre-populate from `savedGoal`/`savedMeaning`/`savedObstacle` when in Coach View (readOnly mode currently doesn't set goalText etc — fix by loading them regardless of readOnly flag at line 128-132).

### 2. `src/components/coach/CoachIntroCard.tsx`
**Remove stale sections (FIX 2):**
- Remove PRE-ENTRY section (lines 226-231)
- Remove the briefSlot prop content passed to TheirStory (lines 208-221) — this is the "After dig deeper — hand to coach" section
- Remove CoachWhyPlan / afterWhySlot (lines 200-207) — this is the "How you'll use it today" field
- Remove "Edit Brief" button (lines 314-323)
- Remove the entire Edit Brief Sheet (lines 334-367)
- Keep "Add Note" button and sheet

**Pass readOnly={false} to TheirStory** so Zone 2 is editable.

**Add POST-CLASS debrief section (FIX 4):** Replace `CoachPrePostClass` usage with a new inline section containing 6 fields (shoutout start/end toggles, got curious toggle, member introduction toggle + text, member pairing plan text, referral ask toggle + text). Reuse the referral lead creation logic from `CoachPrePostClass`. Fetch `coach_member_pair_plan` from intros_booked. All auto-save on change with "Saved" flash.

### 3. `src/components/coach/CoachPrePostClass.tsx`
No changes needed if we inline the post-class logic directly in CoachIntroCard. Alternatively, refactor CoachPrePostClass to only contain POST-CLASS fields (remove PRE-CLASS section which had shoutout consent — already moved).

### 4. `src/components/dashboard/PrepDrawer.tsx` (Print Card)
Add `coach_member_pair_plan` to the fetch query and print layout. In Coach Copy section, after the 5/5 and meaning fields, add:
```
Planned member pair: [coach_member_pair_plan]
```
Only show if not null.

### 5. `src/pages/Wig.tsx`
Add `planned_pairing_rate` column to Coach Lead Measures table. Calculate as % of first intros where `coach_member_pair_plan` is not null. Target: 100%.

### 6. Database view update
Recreate `coach_wig_summary` view to include `planned_pairing_rate` metric.

## Technical Details

- The shoutout consent bar uses `cursor-pointer` and `onClick` to toggle — no Switch component needed
- Zone 2 fields in Coach View use the same `saveZone2Field` function and `onBlur` auto-save pattern
- The realtime subscription on `intros_booked` already exists in TheirStory for coach view — SA edits will flow to coach in real time, and now coach edits will flow to SA view too
- Referral lead creation reuses the existing `createReferralLeads` function from CoachPrePostClass
- The `coach_member_pair_plan` field is a pre-class planning field (visible before class) — it sits in the POST-CLASS section but is editable at any time

