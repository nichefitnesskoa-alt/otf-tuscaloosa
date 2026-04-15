

## Plan: Search Bar for Celebrations + "On 5 Class Pack" Outcome

Two changes: a search filter on the celebrations list, and a new outcome option treated like "Planning to buy."

---

### Change 1 — Search Bar on Celebrations Tab

**File: `src/components/dashboard/MilestonesDeploySection.tsx`**

Add a search input above the celebrations list (between the "Add Celebration" button and the card list). Search filters `milestones` by both `member_name` and `friend_name` (case-insensitive). Real-time filtering — no debounce needed since it's local state.

- New state: `celSearch` string
- Filter: `milestones.filter(m => m.member_name.toLowerCase().includes(term) || (m.friend_name || '').toLowerCase().includes(term))`
- Input placeholder: "Search member or friend name…"
- Place the search input and "Add Celebration" button in a flex row (search left, button right)
- 44px height, standard input styling

---

### Change 2 — New "On 5 Class Pack" Outcome

Treat identically to "Planning to buy" — no coach required, no objection required, clears pending follow-ups, creates a deferred follow-up entry. The result string stored in DB: `"On 5 Class Pack"`.

**Files changed:**

1. **`src/lib/domain/outcomes/types.ts`**
   - Add `'ON_5_CLASS_PACK'` to `IntroResult` type
   - Add `'on 5 class pack': 'ON_5_CLASS_PACK'` to `RESULT_MAP`
   - Add `ON_5_CLASS_PACK` case to `mapResultToBookingStatus` → returns `'ACTIVE'` (same as Planning to Buy)
   - Add `ON_5_CLASS_PACK` case to `formatIntroResultForDb` → returns `'On 5 Class Pack'`

2. **`src/components/myday/OutcomeDrawer.tsx`**
   - Add `{ value: 'On 5 Class Pack', label: '🎁 On 5 Class Pack' }` to `NON_SALE_OUTCOMES`
   - Add `isOn5ClassPack` boolean (same pattern as `isPlanningToBuy`)
   - Skip objection requirement for this outcome (add to `needsObjection` exclusion)
   - Skip coach requirement (add to `coachRequired` exclusion)
   - In save handler: follow the same flow as "Planning to buy" — clear pending follow-ups, no deferred date needed (just log the outcome)
   - Skip notes/coach sections for this outcome (same as Planning to buy)
   - Button label: "Save Outcome"

3. **`src/lib/domain/outcomes/applyIntroOutcomeUpdate.ts`**
   - Add `isNowOn5ClassPack` check: `params.newResult === 'On 5 Class Pack'`
   - Add follow-up queue clear block (same as Planning to Buy pattern at line 327-332)

4. **`src/components/dashboard/OutcomeEditor.tsx`**
   - Add "5 Class Pack" button to the 2×2 grid (expand to 3×2 or 2×3)
   - When selected, saves result `'On 5 Class Pack'`, no objection required, no commission

---

### Files Changed
1. `src/components/dashboard/MilestonesDeploySection.tsx` — add search bar
2. `src/lib/domain/outcomes/types.ts` — add ON_5_CLASS_PACK to IntroResult
3. `src/components/myday/OutcomeDrawer.tsx` — add outcome option
4. `src/lib/domain/outcomes/applyIntroOutcomeUpdate.ts` — add follow-up clearing
5. `src/components/dashboard/OutcomeEditor.tsx` — add button

