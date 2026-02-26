Execute this plan exactly as written with these two additions: 1. F1 and F4 must use ANTHROPIC_API_KEY directly, not Lovable AI gateway. Inject Koa's system prompt verbatim. 2. The phone normalization DB migration must run on ALL tables containing phone fields: intros_booked, leads, vip_registrations, intros_run — not just intros_booked. Proceed with all 5 phases in order. Do not skip any phase.  
  
Comprehensive MyDay + Pipeline + Outcomes + Features Overhaul

This plan covers all items from Groups A through G. Due to the extreme scope (40+ distinct changes), implementation will be broken into phases for reliability.

---

## PHASE 1: Card Fixes + Phone Fix + Outcome Restructure (Groups A1-A5, B1-B7)

### A1: Remove inline confirmation bubble from IntroRowCard

**File: `src/features/myDay/IntroRowCard.tsx**`

- Remove lines 335-344 (the `Confirmed` badge and `Unconfirmed` badge from Row 2)
- Remove lines 428-447 (the "Send 2nd Intro Confirmation" button and "Confirmation Sent" badge from Row 5)
- Row 2 will contain only: phone badge + lead source badge

### A2: Coach TBD and Time TBD tappable inline pickers

**File: `src/features/myDay/IntroRowCard.tsx**`

- Coach name on line 303-305: When `coachName` is null or "TBD", render a tappable `<select>` inline that lists coaches from `COACHES` array. On change, immediately update `intros_booked.coach_name` via Supabase and refresh
- Time TBD already has an inline editor (lines 254-301) so that is already implemented
- Add same coach inline picker pattern to `src/components/myday/MyDayIntroCard.tsx` and any pipeline expanded row views

**File: `src/features/pipeline/components/PipelineSpreadsheet.tsx**`

- In expanded row detail views, make coach name, class time, lead source, and SA/owner fields tappable-to-edit using inline selectors with immediate save

### A3: Remove Assign Owner button from MyDay cards

**File: `src/features/myDay/IntroRowCard.tsx**`

- No "Assign Owner" button currently exists on the card itself (it's in the BulkActionsBar). No changes needed to IntroRowCard.

**File: `src/features/myDay/BulkActionsBar.tsx**`

- Remove the "Assign X" button section (lines 159-183) and related `showOwnerSelect`, `handleBulkAssignOwner`, `handleOwnerSelected` logic
- Remove `bulkAssignIntroOwner` import and related confirm dialog logic

### A4: Remove mass Confirm button from day headers

**File: `src/features/myDay/BulkActionsBar.tsx**`

- Remove the "Confirm X" button (lines 146-157) and the `handleBulkConfirmConfirm` function
- Keep the "Send X Qs" button as it remains useful

### A5: Phone number full app audit

**File: `src/lib/parsing/phone.ts**`

- The current `stripCountryCode` returns null for 10-digit numbers starting with `1`. This is causing display issues because the raw value is shown as fallback. Fix: when `stripCountryCode` returns null, `formatPhoneDisplay` should still attempt to strip a leading 1 from a 10-digit string and format the remaining 9 digits as `(X##) ###-####` -- actually this won't produce valid results.
- Real fix: The data itself contains `15129000350` as 11 digits. `stripCountryCode` correctly strips to `5129000350`. But screenshot shows `(151) 290-0035` which means the stored value is `1512900035` (10 digits, country code partially stripped). Current code returns null for this. Change: for 10-digit numbers starting with `1`, strip the leading `1` to get 9 digits, then check if a valid area code can be recovered. Since we can't recover, instead store/display the number as-is but clearly mark it as needing manual correction.
- Better approach: The root issue is that `formatPhoneDisplay` falls through to returning raw when `stripCountryCode` returns null. Instead, for 10-digit numbers starting with `1`, assume it's a leaked country code and return the last 9 digits formatted as best we can OR just strip the `1` and format the remaining. Since US numbers must be 10 digits, stripping `1` from a 10-digit number gives 9 digits which can't be formatted properly.
- **Final robust approach**: Change `stripCountryCode` to handle 10-digit numbers starting with `1` by treating them as 11-digit numbers with a missing last digit is wrong. Instead, the issue is data quality. The phone field in the DB has `1512900035` which is actually `15129000350` with the last digit truncated during import. The solution: run a DB migration to fix these numbers, AND update `formatPhoneDisplay` to handle 10-digit-starting-with-1 by stripping the `1` and padding/displaying the 9 remaining digits best-effort, OR flagging with a warning badge.
- **Practical fix**: Update `stripCountryCode` to handle 10-digit numbers starting with `1`: strip the `1`, giving 9 digits. Return the 9 digits. Then `formatPhoneDisplay` checks: if < 10 digits after strip, return raw with a note. If exactly 10, format normally.
- Actually, the most common case is an 11-digit number stored as 11 characters like `15129000350`. The current `stripCountryCode` handles this correctly (11 digits starting with 1 → strip → 10 digits). The screenshot value `(151) 290-0035` = digits `1512900035` = 10 digits. `stripCountryCode` returns null because it starts with `1` and is only 10 digits. Fix: when we have 10 digits starting with `1`, also check the `phone_e164` field which might have the full 11-digit version. If `phone_e164` is available, prefer it.
- **Simplest correct fix**: In `useUpcomingIntrosData.ts`, always prefer `phone_e164` over `phone` (it's already doing `phone_e164 || phone`). The `phone_e164` field stores `+15129000350` which strips to `5129000350` correctly. The issue is when `phone_e164` is null and only `phone` has `1512900035`. For those cases, update `stripCountryCode` to: for 10-digit starting with `1`, check if removing the `1` leaves a valid area code (2-9 start). `512900035` starts with `5` → valid. Return `512900035` padded to 10? No, it's only 9 digits.
- **ACTUAL FIX**: The screenshot shows `(151) 290-0035`. Those digits: `1512900035` = 10 digits. The real number is `5129000350` (10 digits). The stored value dropped the trailing `0`. This is a data import bug. The `phone` column has `1512900035` instead of `5129000350` or `15129000350`. We need a migration to fix these. Also update `formatPhoneDisplay` to try: if 10 digits starting with 1, check if `phone_e164` column has the correct value. If not available, display as-is but add error styling.
- **PRAGMATIC CODE FIX**: Update `stripCountryCode` so that for 10-digit numbers starting with `1`, it tries to strip the `1` and returns the 9-digit result. `formatPhoneDisplay` then checks: if result from `stripCountryCode` is non-null but not 10 digits, return raw. If 10 digits, format. Also add a new function `normalizePhoneForStorage` that properly handles 11-digit → 10-digit conversion, to be run as a DB cleanup.

**Full phone audit - files to update with `formatPhoneDisplay`:**

1. `src/features/myDay/IntroRowCard.tsx` — already using it (line 322)
2. `src/features/pipeline/components/PipelineSpreadsheet.tsx` — already using it (line 24 import)
3. `src/components/myday/MyDayIntroCard.tsx` — NOT using it (line 140-146 shows raw `booking.phone`)
4. `src/components/leads/LeadCard.tsx` — passes `lead.phone` raw
5. `src/components/dashboard/FollowUpsDueToday.tsx` — uses raw phone
6. `src/components/ActionBar.tsx` — copies raw phone (line 306)
7. `src/components/admin/VipGroupDetail.tsx` — raw phone display
8. `src/components/vip/ConvertVipToIntroDialog.tsx` — passes raw phone
9. `src/components/IntroRunEntry.tsx` — raw phone

**DB Migration**: Add a one-time phone normalization that updates `phone` and `phone_e164` columns in `intros_booked` to clean 10-digit format.

### B1-B3: Remove "Didn't Buy", add "Follow Up Needed"

**File: `src/components/myday/OutcomeDrawer.tsx**`

- Remove `{ value: "Didn't Buy", label: "❌ Didn't Buy" }` from `NON_SALE_OUTCOMES` (line 36)
- Already has `{ value: 'Follow-up needed', label: '📋 Follow-up needed' }` (line 39) — this replaces "Didn't Buy"
- Update `needsObjection` (line 156): change from `outcome === "Didn't Buy" || outcome === 'No-show'` to `outcome === 'Follow-up needed'` (Follow Up Needed requires objection, No-show does not require objection per the prompt)
- Add objection chips for "Follow-up needed" that match the existing objection pattern

**File: `src/components/dashboard/OutcomeEditor.tsx**`

- Replace "Didn't Buy" button with "Follow-up" button
- Update `wasDidntBuy` and `didnt_buy` references to `follow_up_needed`

**File: `src/lib/domain/outcomes/applyIntroOutcomeUpdate.ts**`

- Update all references: `isNowDidntBuy` → check for both `"Didn't Buy"` (legacy) and `"Follow-up needed"` (new)
- Follow-up queue generation stays the same, just triggers on "Follow-up needed" instead

**File: `src/features/myDay/IntroRowCard.tsx**`

- Update outcome result banner (lines 570-596): replace `"Didn't Buy"` display with `"Follow-up needed"` display

**File: `src/features/pipeline/components/PipelineSpreadsheet.tsx**`

- Update `OutcomeBadge` component (line 77): replace `"Didn't Buy"` label

**File: `src/components/dashboard/CloseOutShift.tsx**`

- Replace `didntBuyCount` references with follow-up needed count
- Update GroupMe message text

**Other files with "Didn't Buy" references**: `TodayActivityLog.tsx`, `FollowUpPurchaseSheet.tsx` — update display strings

### B4: Booked 2nd Intro sub-options

**File: `src/components/myday/OutcomeDrawer.tsx**`

- When outcome is "Booked 2nd intro", add a required sub-selection section: "What's holding them back?"
- Chip options: Price/Cost, Needs to think, Needs parents/spouse, Timing, Wants to try first, Other (free text)
- Store selection as `second_intro_reason` on the `intros_run` record
- Add `second_intro_reason` column to `intros_run` table via migration

### B5: 2nd intro prep card shows previous visit data prominently

**File: `src/components/dashboard/PrepDrawer.tsx**`

- When `isSecondIntro === true`, add a prominent section at the very top (before transformative one-liner):
  - Orange-bordered box: "FROM THEIR FIRST VISIT"
  - Large bold orange text: the objection from first visit
  - Their objection notes
  - Goal and Why from questionnaire
  - If no questionnaire: fallback text with just the objection type

### B6: Outcomes tab badge verification

- Already using `needsOutcome` filter in `MyDayPage.tsx` line 204-212 which counts past bookings without runs. Verify this counts only unresolved. Current query filters `class_date < today` and `deleted_at IS NULL` and `booking_status_canon != 'CANCELLED'` but doesn't check if a run exists. Need to add `.not('id', 'in', subquery_of_run_linked_ids)` or use a left join approach. Will fix by checking against intros_run.

### B7: Migrate existing "Didn't Buy" records

**DB Migration**: 

```sql
UPDATE intros_run SET result = 'Follow-up needed', result_canon = 'FOLLOW_UP_NEEDED' 
WHERE result_canon = 'DIDNT_BUY' OR result = $$Didn't Buy$$;
```

---

## PHASE 2: Win the Day + Scoreboard + Grouping (Groups C, D)

### C1: Completed tasks collapse into dropdown

**File: `src/features/myDay/WinTheDay.tsx**`

- Split `items` into `activeItems` (not completed) and `completedItems` (completed)
- Render `activeItems` in the main list
- Render `completedItems` in a collapsible section at the bottom: "Completed ✓ (X)" — collapsed by default
- Use `Collapsible` component for the completed section

### C2: All Win the Day buttons navigate — no toasts

**File: `src/features/myDay/WinTheDay.tsx**`

- Already implemented for most actions (lines 96-163). Verify no remaining toasts say "navigate to..."
- Add missing mappings:
  - `cold_texts` → open contact logger inline with type=Text (currently opens reflection drawer)
  - `cold_dms` → open contact logger inline with type=DM
  - For `confirm_tomorrow`: also dispatch `myday:open-script` after scrolling to card
- Remove any remaining "navigate to the intro card" toast text

### D1: Remove scoreboard middle row

**File: `src/components/dashboard/StudioScoreboard.tsx**`

- Remove lines 94-151: the entire "Show Rate Row" section (Booked, Show Rate, No-Shows grid)
- Keep: Main Metrics Row (Intros Run, Sales, Close Rate) + Lead Measures Row
- Remove `introsBooked`, `introsShowed`, `noShows` props from interface

### D2: Fix Q Completion % — show Sent% and Completed% separately

**File: `src/components/dashboard/StudioScoreboard.tsx**`

- Update `LeadMeasureCard` for Q Completion to show two sub-metrics:
  - "Sent: X%" — questionnaires sent / total 1st intro bookings
  - "Completed: X%" — questionnaires completed / total 1st intro bookings
- Add `qSentRate` prop alongside `qCompletionRate`
- Update calculation source (likely in `useDashboardMetrics.ts` or wherever the scoreboard is rendered) to pass both values

### D3: Group intros by class time within each day

**File: `src/features/myDay/IntroDayGroup.tsx**`

- Within each day group, sub-group items by `introTime` (rounded to class session, e.g., "6:15 AM")
- Render a subtle time header between groups: "6:15 AM — 3 intros"
- Sort items within each time group by name

---

## PHASE 3: Pipeline + Data Fixes (Group E)

### E1: Remove Not Interested from Missed Guests tab

**File: `src/features/pipeline/selectors.ts**`

- In the function that filters journeys for the "Missed" tab, add filter: exclude journeys where status === 'not_interested'

### E2: Referral auto-detection + inline fix

**File: `src/components/admin/ReferralTracker.tsx` or `src/components/admin/ReferralLeaderboard.tsx**`

- Add auto-detection: when rendering referral leaderboard, query purchase records for referred people. If a referral entry has status "Pending" but the referred person has a purchase in `intros_run`, auto-update to "Purchased"
- Add inline "Mark as Purchased" button on Pending entries
- Add realtime subscription on referral leaderboard

**File: `src/lib/domain/outcomes/applyIntroOutcomeUpdate.ts**`

- After a purchase is logged, check if this person's booking has a `referred_by_member_name`. If so, check/update the referral record

### E3: Delete capability for old leads

**File: `src/components/leads/LeadListView.tsx` or `src/pages/Leads.tsx**`

- Add "Select" mode toggle with checkboxes on each lead card
- "Delete Selected" button with confirmation dialog
- "Select all in this sub-tab" checkbox
- Permanent delete from `leads` table

### E4: Fix on the spot — universal inline editing

This expands on A2. Files affected:

- `src/features/myDay/IntroRowCard.tsx` — coach picker (A2), lead source picker, SA picker
- `src/features/pipeline/components/PipelineSpreadsheet.tsx` — inline editing for coach, time, lead source, SA, outcome, commission (admin only)
- Use consistent pattern: tappable text → inline select/input → save on change → refresh

---

## PHASE 4: New Features (Group F)

### F1: AI Script Generator

**New file: `supabase/functions/generate-script/index.ts**`

- Edge function that calls Lovable AI gateway with Koa's principles as system prompt
- Accepts: person name, goal, why, obstacle, fitness level, objection, lead source, script category
- Returns: generated script text

**File: `src/components/scripts/ScriptPickerSheet.tsx**`

- Add "AI Generate" button that opens a panel
- Panel shows pre-filled context from booking data
- Script category selector
- Generate/Regenerate/Use This Script buttons
- "Use This Script" copies to clipboard and logs as sent

### F2: Coach button redesign

**File: `src/components/myday/CoachDrawer.tsx**`

- Restructure into two sections:
  1. **IN-CLASS ACTIONS**: Generated from fitness level and goal. 3-4 bullet points.
  2. **EXPERIENCE ENHANCERS**: Suggested lines coach can use. Generated from questionnaire data.
- Remove current "Handoff Script" and "During Class" sections
- Replace with the new format. Use static templates keyed on fitness level + goal keywords.

### F3: Print card redesign — SA half + Coach half

**File: `src/components/dashboard/PrepDrawer.tsx**`

- Update print layout to fit one letter-size page
- Top half: SA Prep (name, date, time, transformative one-liner, story, dig deeper checkboxes, RFG)
- Dashed cut line
- Bottom half: Coach Handoff (goal, level, in-class actions, "say this" line, after-class EIRMA)
- Use `@media print` CSS for layout

### F4: Studio Intelligence — daily card (Admin only)

**New file: `supabase/functions/studio-intelligence/index.ts**`

- Edge function that queries previous day's data + pay period trends
- Generates intelligence card via Lovable AI
- Stores result in a new `studio_intelligence` table

**New file: `src/components/admin/StudioIntelligenceCard.tsx**`

- Renders the daily intelligence card
- Shown at top of MyDay for Admin users, and in Admin > Daily Intelligence tab

**DB Migration**: Create `studio_intelligence` table with `id`, `report_date`, `content_json`, `created_at`

### F5: Script auto-personalization on prep cards

**File: `src/components/dashboard/PrepDrawer.tsx**`

- For 1st intros: add "Studio Trends" section showing current pay period's top objection
- For 2nd intros: already handled by B5 (previous visit objection at top)

---

## PHASE 5: Focus Mode + Q Escalation + Audit Expansion (A6, A7, G1)

### A6: Focus mode — 2 hours before intro

**File: `src/features/myDay/IntroRowCard.tsx**`

- Add state: compute `minutesUntilClass` from `classDate + introTime`
- When <= 120 minutes away:
  - Add `ring-2 ring-orange-500 animate-pulse` (slow pulse) to card border
  - Show countdown timer: "Class in 1h 45m"
  - If not prepped: Prep button gets `animate-pulse` with orange color
- All other cards get `opacity-80`

**File: `src/features/myDay/UpcomingIntrosCard.tsx` or `IntroDayGroup.tsx**`

- Pass a `focusBookingId` prop identifying the nearest upcoming intro within 2 hours
- Apply `opacity-80` to all cards except the focused one

### A7: Questionnaire overdue 3 hours before class

**File: `src/features/myDay/IntroRowCard.tsx**`

- When `questionnaireStatus === 'Q_SENT'` AND class is within 3 hours:
  - Banner changes from amber to red: "🔴 Questionnaire Overdue — Class in Xh Xm"
  - Card border turns red

**File: `src/features/myDay/useWinTheDayItems.ts**`

- When a Q_SENT item is within 3 hours, set urgency to 'red' and sortOrder to 50 (highest priority)
- Change text: "⚠ [Name]'s questionnaire still not answered — class in [time]"

### G1: Performance data consistency audit

**File: `src/lib/audit/dataAuditEngine.ts**`

- Add new checks:
  1. `checkCloseRateConsistency` — verify sales/intros_run matches displayed close rate
  2. `checkQCompletionConsistency` — verify completed Q count matches displayed %
  3. `checkCommissionTotals` — verify pay period sum matches individual records
  4. `checkReferralPendingStatus` — auto-fix pending → purchased where purchase exists

---

## DB Migrations Required

1. **Migrate "Didn't Buy" to "Follow Up Needed"**:

```sql
UPDATE intros_run SET result = 'Follow-up needed', result_canon = 'FOLLOW_UP_NEEDED' 
WHERE result_canon = 'DIDNT_BUY' OR result = 'Didn''t Buy';
```

2. **Add `second_intro_reason` column to intros_run**:

```sql
ALTER TABLE intros_run ADD COLUMN IF NOT EXISTS second_intro_reason text;
```

3. **Phone normalization**:

```sql
UPDATE intros_booked 
SET phone = CASE 
  WHEN phone ~ '^\+1\d{10}$' THEN substring(phone from 3)
  WHEN phone ~ '^1\d{10}$' THEN substring(phone from 2)
  ELSE phone 
END
WHERE phone IS NOT NULL AND (phone ~ '^\+1\d{10}$' OR phone ~ '^1\d{10}$');
```

4. **Create studio_intelligence table**:

```sql
CREATE TABLE public.studio_intelligence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_date date NOT NULL UNIQUE,
  content_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.studio_intelligence ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage" ON public.studio_intelligence FOR ALL USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Authenticated can read" ON public.studio_intelligence FOR SELECT USING (auth.uid() IS NOT NULL);
```

---

## Files Changed Summary


| File                                                       | Changes                                                                                  |
| ---------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `src/lib/parsing/phone.ts`                                 | Fix `stripCountryCode` for edge cases; improve `formatPhoneDisplay`                      |
| `src/features/myDay/IntroRowCard.tsx`                      | A1 remove inline confirmation, A2 coach picker, A5 phone, A6 focus mode, A7 Q escalation |
| `src/features/myDay/BulkActionsBar.tsx`                    | A3 remove assign owner, A4 remove confirm button                                         |
| `src/features/myDay/WinTheDay.tsx`                         | C1 completed collapse, C2 all buttons navigate                                           |
| `src/features/myDay/useWinTheDayItems.ts`                  | A7 Q escalation priority, C2 action mappings                                             |
| `src/features/myDay/IntroDayGroup.tsx`                     | D3 class time grouping                                                                   |
| `src/features/myDay/UpcomingIntrosCard.tsx`                | A6 focus mode prop passing                                                               |
| `src/features/myDay/MyDayPage.tsx`                         | F4 studio intelligence card for admins                                                   |
| `src/components/myday/OutcomeDrawer.tsx`                   | B1-B4 outcome restructure                                                                |
| `src/components/myday/MyDayIntroCard.tsx`                  | A5 phone formatting                                                                      |
| `src/components/myday/CoachDrawer.tsx`                     | F2 coach redesign                                                                        |
| `src/components/dashboard/StudioScoreboard.tsx`            | D1 remove middle row, D2 Q split metrics                                                 |
| `src/components/dashboard/PrepDrawer.tsx`                  | B5 2nd intro previous visit, F3 print redesign, F5 studio trends                         |
| `src/components/dashboard/OutcomeEditor.tsx`               | B1-B3 outcome rename                                                                     |
| `src/components/dashboard/CloseOutShift.tsx`               | B1 rename didn't buy references                                                          |
| `src/components/dashboard/TodayActivityLog.tsx`            | B1 rename references                                                                     |
| `src/components/dashboard/FollowUpPurchaseSheet.tsx`       | B1 rename references                                                                     |
| `src/components/leads/LeadCard.tsx`                        | A5 phone formatting                                                                      |
| `src/components/leads/LeadListView.tsx`                    | E3 delete capability                                                                     |
| `src/components/ActionBar.tsx`                             | A5 phone formatting                                                                      |
| `src/features/pipeline/components/PipelineSpreadsheet.tsx` | A5 phone, E4 inline editing                                                              |
| `src/features/pipeline/selectors.ts`                       | E1 not interested filter                                                                 |
| `src/components/admin/ReferralTracker.tsx`                 | E2 auto-detection + inline fix                                                           |
| `src/lib/domain/outcomes/applyIntroOutcomeUpdate.ts`       | B1 outcome rename, E2 referral check                                                     |
| `src/lib/audit/dataAuditEngine.ts`                         | G1 performance checks                                                                    |
| `src/components/scripts/ScriptPickerSheet.tsx`             | F1 AI generate button                                                                    |
| `supabase/functions/generate-script/index.ts`              | F1 AI script edge function (new)                                                         |
| `supabase/functions/studio-intelligence/index.ts`          | F4 daily intelligence (new)                                                              |
| `src/components/admin/StudioIntelligenceCard.tsx`          | F4 intelligence card (new)                                                               |


---

## Notes on interpretation

- **A5 phone fix**: The root cause is likely data quality in the `phone` column. The code fix ensures `formatPhoneDisplay` handles all edge cases, plus a DB migration normalizes existing data.
- **B1 "Didn't Buy" removal**: All display strings change to "Follow-up needed". The canonical function `applyIntroOutcomeUpdate` will accept both values during transition but generate follow-ups for both.
- **B4 `second_intro_reason**`: Requires a new column on `intros_run` — DB migration included.
- **F1 AI Script Generator**: Uses Lovable AI gateway (already has `LOVABLE_API_KEY`). No additional API keys needed.
- **F4 Studio Intelligence**: Uses Lovable AI gateway for generation. Admin-only via `has_role` check.
- **E2 Mary Waller / Brinkli Wood**: Will be handled by the auto-detection logic, not hardcoded.