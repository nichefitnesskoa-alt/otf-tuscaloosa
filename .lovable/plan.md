

## Goal
Two changes to the VIP flow on My Day:

1. **VIP card privacy** — hide individual registrant names. Show only the group name and total registration count.
2. **New outcome: "VIP Class Intro"** — when logging the outcome of a follow-up intro that came from a VIP class, SAs can pick "VIP Class Intro (not expected to buy)". Backend treats it the same as "Not interested" (status = NOT_INTERESTED, clears pending follow-ups, no commission, no AMC), but the displayed label and reporting tag stay distinct so it's visible these came in via the VIP funnel and weren't real buying intros.

## Changes

### 1. VIP Group card on My Day — hide names, show counts only
**`src/features/myDay/VipRegistrationsSheet.tsx`**

Replace the per-registrant card list with a clean roll-up:

- **Header** stays: group name + `{N} registered`
- **Coach picker** stays at the top (still required for sale attribution)
- **Body** becomes a single summary block:
  - Big count: `{N} people registered`
  - One-line breakdown of any logged outcomes if present (e.g., "3 showed · 1 booked intro · 2 no-show"). Counts only — no names.
  - **Bulk outcome controls** for the whole group are removed; per-attendee outcome logging happens later via the actual intro card if/when one of them books an intro.
- **"Booked an Intro" inline form is removed from this sheet.** That workflow now lives where it should: when an attendee actually books a follow-up intro, it's a regular intro card on My Day with `lead_source = 'VIP Class'` and `vip_session_id` set (already happening today via the public VIP signup flow + the regular Book Intro sheet). The SA logs that outcome through the standard OutcomeDrawer like any other intro.
- Sheet description updates: `"{N} registered for this VIP class. We don't store names — privacy by design."`

This drops the `Registration` interface usage to a single aggregate query: `select count, outcome` grouped client-side. No PII rendered. No outcome dropdowns per row. No phone/email/birthday/weight/fitness/injuries displayed.

**Outcome:** SAs see "Pi Phi — 14 registered" and the coach picker. Nothing more. Names never appear on screen.

### 2. New outcome — "VIP Class Intro (not expected to buy)"
**`src/components/myday/OutcomeDrawer.tsx`**

Add a new entry to `NON_SALE_OUTCOMES` (right after "Not interested"):
```
{ value: 'VIP Class Intro', label: '🎟️ VIP Class Intro (not expected to buy)' }
```

This outcome is **only shown when the booking is a VIP Class intro** (`lead_source` starts with `'VIP Class'` AND `vip_session_id` is set) — gated by an `isVipClassIntro` prop passed in from the calling card. For all other intros the option is hidden so it can't be misused.

**`src/lib/domain/outcomes/types.ts`**
- Add new `IntroResult` value: `'VIP_CLASS_INTRO'`
- Add to `RESULT_MAP`: `'vip class intro' → 'VIP_CLASS_INTRO'`
- `mapResultToBookingStatus('VIP_CLASS_INTRO')` returns `'NOT_INTERESTED'` (treats them the same as Not Interested in backend)
- `formatIntroResultForDb('VIP_CLASS_INTRO')` returns `'VIP Class Intro'` (so the run row stores the distinct label, not "Not interested")

**`src/lib/domain/outcomes/applyIntroOutcomeUpdate.ts`**
- Add `const isNowVipClassIntro = params.newResult === 'VIP Class Intro';`
- Treat it identically to `isNowNotInterested` everywhere it appears: clears pending follow-ups (line 313–318), skips AMC, skips commission, skips follow-up generation. Single OR added to that branch.
- Result: the booking ends in `booking_status_canon = 'NOT_INTERESTED'`, no follow-up tasks, no commission — but `intros_run.result = 'VIP Class Intro'` and `result_canon = 'VIP_CLASS_INTRO'` so reports can distinguish "real Not Interested" vs "VIP attendee who didn't buy (expected)".

**`src/components/dashboard/IntroTypeBadge.tsx`** already shows the purple "VIP Class Intro" badge — no change.

### 3. Reporting — VIP Class Intro outcomes excluded from negative metrics
The whole point of distinguishing this outcome is so VIP-attendee non-buyers don't drag down close-rate metrics. Two reporting touchpoints:

- **`src/pages/Wig.tsx` Per-Coach close map** + **`src/components/dashboard/PerCoachTable.tsx`**: when iterating runs to compute coach close rates, exclude runs whose `result_canon === 'VIP_CLASS_INTRO'` from the **denominator** (don't count VIP attendees toward "intros coached" in close-rate math) AND from the numerator. They simply don't count. Otherwise a coach who just hosted a 30-person VIP class with 2 buyers would look like a 7% closer.
- **`src/features/pipeline/usePipelineData.ts` / Per-SA Performance**: same exclusion — `result_canon === 'VIP_CLASS_INTRO'` runs are excluded from SA close-rate denominators. (VIP-attendee bookings inflated SA denominators is the same problem.)

These are dedicated reporting carve-outs — the runs still exist, AMC and commission stay zero, but they don't appear in close-rate ratios. They're countable separately as "VIP-funnel intros" wherever needed.

## Files changed
1. **`src/features/myDay/VipRegistrationsSheet.tsx`** — strip per-registrant rows, render aggregate count + outcome roll-up only; remove inline booking form, friend form, all PII rendering. Coach picker stays.
2. **`src/lib/domain/outcomes/types.ts`** — add `'VIP_CLASS_INTRO'` to `IntroResult`, map, formatter, `mapResultToBookingStatus → 'NOT_INTERESTED'`.
3. **`src/lib/domain/outcomes/applyIntroOutcomeUpdate.ts`** — treat `'VIP Class Intro'` result identically to "Not interested" in backend (clear pending follow-ups, skip AMC, skip commission).
4. **`src/components/myday/OutcomeDrawer.tsx`** — add new outcome option, gated to `isVipClassIntro` bookings only.
5. **`src/features/myDay/IntroRowCard.tsx`** — pass `isVipClassIntro` prop into OutcomeDrawer (already known on the item).
6. **`src/pages/Wig.tsx`** — exclude `result_canon === 'VIP_CLASS_INTRO'` runs from Per-Coach close numerator + denominator.
7. **`src/components/dashboard/PerCoachTable.tsx`** — same exclusion.
8. **`src/features/pipeline/usePipelineData.ts`** (or wherever Per-SA close rate is computed) — same exclusion from SA close-rate denominator.

## Files audited, no change needed
- VIP signup flows (`VipRegister.tsx`, `VipMemberRegister.tsx`) — registration writes still happen as today; we're only changing what My Day **displays**.
- `vip_registrations` table — schema unchanged.
- Friend referral / paired booking logic — unchanged. (When an intro is booked from a VIP class, it still happens via the standard Book Intro sheet which already knows about VIP source attribution.)
- Commission rules — unchanged. `'VIP Class Intro'` is a non-sale, computeCommission returns 0 already.
- Total Journey funnel — unchanged. VIP intros that **do** buy still credit normally; only non-buying VIP attendees get the carve-out.

## Downstream effects
- My Day VIP cards no longer show any individual registrant info — only group name + count + coach picker.
- SAs who used to pick "Booked an Intro" inside the registrants sheet now book the intro through the normal Book Intro sheet on the floor (same place they book any walk-in), with `lead_source = 'VIP Class'` pre-selected. The booking still ties back to the VIP session via `vip_session_id` for coach attribution.
- New "VIP Class Intro (not expected to buy)" outcome appears in the OutcomeDrawer dropdown only for intros that came from a VIP class — invisible everywhere else.
- Picking that outcome: booking goes to `NOT_INTERESTED`, no commission, no AMC, no follow-up tasks created. `intros_run.result = 'VIP Class Intro'` so reports can differentiate.
- Close-rate metrics (Per-Coach on WIG + Recaps, Per-SA on Recaps) exclude these runs entirely — they don't count for or against anyone's close rate.
- Existing "Not interested" outcome and behavior unchanged.
- No retroactive change. Past data unaffected.
- No RLS changes, no role permission changes.
- Central Time conventions preserved.

