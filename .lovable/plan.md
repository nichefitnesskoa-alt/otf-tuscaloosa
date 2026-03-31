

# Show Objection Reasons in Drill-Downs + Require Objection on All Non-Sale Outcomes + Admin Objection Report

## Problem
1. When drilling into "Showed" in the Conversion Funnel and Lead Source Analytics, people who didn't buy show their raw result (e.g. "Follow-up needed") but not **why** they didn't sign.
2. Objection is only required for "Follow-up needed" outcome — other non-sale outcomes like "No-show", "Planning to Book 2nd Intro", "Booked 2nd intro", "Not interested" don't capture a reason.
3. No admin report exists to view objection trends across time periods.

## Changes

### 1. Show objection in Showed drill-down detail (`ConversionFunnel.tsx` + `useDashboardMetrics.ts`)

Currently `showedPeople` uses `showedRun.result` as `detail`. Change to show the `primary_objection` when the person didn't purchase.

- In `ConversionFunnel.tsx` lines ~141-156: When building `firstSP`/`secondSP`, if the run result is not a sale, set `detail` to `run.primary_objection || run.result` instead of just `run.result`.
- In `useDashboardMetrics.ts` line ~391: Same change for `showedPeople` in lead source metrics — show `(run as any).primary_objection || showedRun.result` as the detail.
- Update `DrillPerson` display: no structural change needed since `detail` already renders as a Badge.

### 2. Require objection on all non-sale, non-no-show outcomes

**`OutcomeDrawer.tsx`**: Expand `needsObjection` from just `Follow-up needed` to include `Booked 2nd intro`, `Planning to Book 2nd Intro`, and `Not interested`:
```typescript
const needsObjection = !isSale && !isNoShow && !isReschedule && !isPlanningToReschedule && !!outcome;
```
The existing validation (`if (needsObjection && !objection)`) and objection dropdown already handle the rest. The objection will be passed to `applyIntroOutcomeUpdate` which stores it in `primary_objection`.

**`OutcomeEditor.tsx`**: Similarly expand — require objection for `planning_2nd` outcome (currently only `follow_up` requires it). Add the objection selector for `planning_2nd`.

### 3. New Admin Objection Report tab (`src/components/admin/ObjectionReport.tsx`)

Create a new component that:
- Queries `intros_run` table for `primary_objection`, `result`, `member_name`, `run_date`, `intro_owner`, `lead_source` within a date range
- Shows a summary card with objection counts as a horizontal bar chart (sorted by frequency)
- Below, a filterable table listing each person, their objection, result, SA, lead source, and date
- Date range filter using the existing `DateRangeFilter` component
- Filter by specific objection type

Add this as a new tab in `Admin.tsx` — insert between existing tabs (e.g. after Intelligence).

### 4. Pass objection through for all non-sale outcomes in OutcomeDrawer

Currently line 395: `objection: needsObjection ? objection : null`. With the expanded `needsObjection`, this already works. For `Booked 2nd intro`, the objection captures "what's holding them back" — this is separate from `secondIntroReason` which is a more specific sub-field. We'll use the same OBJECTION_OPTIONS list.

## Files to Create/Edit

| File | Action |
|------|--------|
| `src/components/myday/OutcomeDrawer.tsx` | Expand `needsObjection` to cover all non-sale/non-no-show outcomes |
| `src/components/dashboard/OutcomeEditor.tsx` | Add objection requirement for `planning_2nd` |
| `src/components/dashboard/ConversionFunnel.tsx` | Show `primary_objection` in showed drill-down detail |
| `src/hooks/useDashboardMetrics.ts` | Show `primary_objection` in lead source showed drill-down |
| `src/components/admin/ObjectionReport.tsx` | **New** — admin objection analytics report |
| `src/pages/Admin.tsx` | Add Objection Report tab |

