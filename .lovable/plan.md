

## Plan: Add "Planning to Buy" Outcome with Deferred Follow-Up

### What This Does
Adds a new "Planning to Buy" outcome option to the outcome drawer. When selected, the SA enters the date the person plans to buy. The follow-up system holds them in a dedicated "Planning to Buy" section and only surfaces them 1 day before their planned purchase date — no premature outreach.

---

### Change 1 — Add "Planning to Buy" to Outcome Drawer

**File: `src/components/myday/OutcomeDrawer.tsx`**
- Add `{ value: 'Planning to buy', label: '🛒 Planning to buy' }` to `NON_SALE_OUTCOMES`
- When "Planning to buy" is selected, show a date picker: "When do they plan on buying?"
- Require date selection before save
- On save: call `applyIntroOutcomeUpdate` with result "Planning to buy", then insert a single `follow_up_queue` record with `person_type = 'planning_to_buy'`, `scheduled_date` = 1 day before the selected buy date
- Store the planned buy date in `follow_up_queue.fitness_goal` field (reusing existing nullable text column to avoid a migration — value stored as YYYY-MM-DD string)
- No objection required, no coach required

### Change 2 — Outcome Pipeline Support

**File: `src/lib/domain/outcomes/applyIntroOutcomeUpdate.ts`**
- Add `isNowPlanningToBuy` detection for "Planning to buy"
- On this outcome: clear existing pending follow-ups, skip standard follow-up generation (OutcomeDrawer handles the queue insert)
- Map to `booking_status_canon = 'ACTIVE'` (keeps them in pipeline)

**File: `src/lib/domain/outcomes/types.ts`**
- Add `'PLANNING_TO_BUY'` to `IntroResult` type
- Add normalizer mapping: `'planning to buy' → 'PLANNING_TO_BUY'`
- Map `PLANNING_TO_BUY → ACTIVE` in `mapResultToBookingStatus`
- Add display formatter: `'Planning to buy'`

### Change 3 — Follow-Up Data Hook: New Category

**File: `src/features/followUp/useFollowUpData.ts`**
- Add `'planning_to_buy'` to `FollowUpType` union
- Add new array state for planning-to-buy items
- In the data fetch, query `follow_up_queue` records with `person_type = 'planning_to_buy'` and merge them into the follow-up list
- **Key logic**: These items only appear in "Focus Today" when `scheduled_date <= today` (i.e., 1 day before their planned buy date). Before that, they sit in "Coming Up" with a label showing the planned date.

### Change 4 — Follow-Up List UI: New Filter + Section

**File: `src/features/followUp/FollowUpList.tsx`**
- Add `planning_to_buy` to `FilterType`, `TYPE_LABELS`, `TYPE_SHORT_LABELS`, `TYPE_COLORS`
- Label: "Planning to Buy" — color: blue/teal to distinguish
- Add filter pill: "Planning to Buy"
- Cards in this category show the planned buy date and a countdown ("Buying in X days")

### Change 5 — Canon Fallback

**File: `src/lib/canon/canonFallback.ts`**
- Add `'planning to buy': 'PLANNING_TO_BUY'` to `RESULT_CANON_MAP`
- Add `PLANNING_TO_BUY` to `ResultCanon` type
- Not terminal (follow-up continues)

---

### Files Changed
1. `src/components/myday/OutcomeDrawer.tsx` — new outcome + date picker UI
2. `src/lib/domain/outcomes/applyIntroOutcomeUpdate.ts` — handle new outcome in pipeline
3. `src/lib/domain/outcomes/types.ts` — add PLANNING_TO_BUY to type system
4. `src/lib/canon/canonFallback.ts` — add canon mapping
5. `src/features/followUp/useFollowUpData.ts` — new follow-up category
6. `src/features/followUp/FollowUpList.tsx` — new filter pill + display
7. `src/pages/CoachMyIntros.tsx` — recognize new outcome for coach view

### No Database Migration Needed
Reuses `follow_up_queue.fitness_goal` (text, nullable) to store the planned buy date. No new columns required.

