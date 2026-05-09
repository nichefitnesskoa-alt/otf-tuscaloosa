
## Root cause: Alexa Brodsky shows "—" instead of "SALE"

Alexa actually IS being counted as a close in both WIG and Studio (the footer "Counted as Close (2nd intro · Total Journey): 1" is her). The drill row just looks wrong. Here is her data chain:

```text
Booking 467a (May 1, originating)  → run result_canon = SECOND_INTRO_SCHEDULED
  ↳ Booking b647 (May 4, child)    → run result_canon = PREMIER  ← the actual sale
  ↳ Booking 0b19 (May 1, child)    → run result_canon = FOLLOW_UP_NEEDED
```

Her first-intro row uses canon `SECOND_INTRO_SCHEDULED`, but the `labelFor` / `labelFromRun` helpers in `Wig.tsx`, `PerCoachTable.tsx`, and `CoachAttributionDrillDown.tsx` only know about a stale set of canon strings (`PLANNING_2ND`, `PLANNING_2ND_INTRO`, `FOLLOW_UP`, `SALE`). The real DB canon values are different — confirmed via query:

```text
SECOND_INTRO_SCHEDULED   71 rows   (label: "Booked 2nd intro")
FOLLOW_UP_NEEDED         90 rows   (label: "Follow-up needed")
PLANNING_TO_BUY          11 rows
PLANNING_2ND_INTRO       23 rows
NOT_INTERESTED           30 rows
ON_5_CLASS_PACK           4 rows
PREMIER / PREMIER_OTBEAT 62 rows   (sale)
ELITE                    18 rows   (sale)
BASIC                     3 rows   (sale)
NO_SHOW / VIP_CLASS_INTRO / UNRESOLVED
```

Anything not in the helper falls through to `—`. So Alexa's row says `—` even though she's counted as a close, and any other "Booked 2nd intro" or "Follow-up needed" row also shows `—`. Worse: the close-detection branches in `PerCoachTable.tsx` (line ~129) and `Wig.tsx` (the Total Journey lookup) check `result_canon === 'SALE'`, which never matches; closes only register today because of the `isMembershipSale(r.result)` string fallback. If a future row arrives with `result_canon = PREMIER` and a non-membership `result` string, it would silently miss.

Same canon mismatch exists in: `lib/intros/close-detection.ts`, anywhere using `result_canon === 'SALE'` or `result_canon === 'FOLLOW_UP'`.

## Fixes

### 1. Canonical result helpers (single source of truth)

Add `src/lib/intros/resultLabels.ts`:

```text
SALE_CANONS        = PREMIER, PREMIER_OTBEAT, ELITE, BASIC, SALE
FOLLOWUP_CANONS    = FOLLOW_UP, FOLLOW_UP_NEEDED
PLANNING_2ND_CANONS = PLANNING_2ND, PLANNING_2ND_INTRO, SECOND_INTRO_SCHEDULED

isSaleCanon(rc)          → boolean
isFollowUpCanon(rc)      → boolean
isPlanning2ndCanon(rc)   → boolean
labelForRun({result_canon, result}) → "SALE" | "Booked 2nd" | "Follow-Up" |
                                       "Planning to Buy" | "Not Interested" |
                                       "5 Class Pack" | "No Show" | "VIP Intro" |
                                       "Unresolved" | "—"
```

Replace local `labelFor` / `labelFromRun` in `Wig.tsx`, `PerCoachTable.tsx`, and the result-tone map in `CoachAttributionDrillDown.tsx` with these helpers. Add tones for the new labels.

### 2. Make "became a sale via 2nd intro" obvious in the Coached drill

Right now the originator row sits in `coached` with label "—" while a separate row sits in `closes` tagged `via: '2nd_intro'`. The Coached view never reveals the link.

When pushing the first-intro row into `coached`, also set `via2ndIntroSale: true` if `secondRunSaleSet.has(booking.id)` (WIG) / the second-sale-lookup matches (Studio). In `CoachAttributionDrillDown.tsx`, when `via2ndIntroSale` is true on a Coached row, render an additional badge "→ SALE via 2nd intro" alongside the result label so Alexa shows as **Booked 2nd · → SALE via 2nd intro** instead of `—`.

### 3. Audit other places using stale canon strings

Grep `result_canon === 'SALE'`, `'FOLLOW_UP'`, `'PLANNING_2ND'` (no `_INTRO`) and route them through `isSaleCanon` / `isFollowUpCanon` / `isPlanning2ndCanon`. Files to check: `lib/intros/close-detection.ts`, `Wig.tsx`, `PerCoachTable.tsx`, any close-rate / 2nd-sale lookup. Report each touched file at the end. No silent symptom patches — fix the helper at the source.

### 4. Make every person-tied number tappable across WIG and Studio

Reuse / extend `CoachAttributionDrillDown.tsx` into a shared `PersonListDrillDown.tsx` that takes `{ title, subtitle, source, items: AttribIntro[], footer? }` so any table can open it without bespoke modals.

**WIG (`src/pages/Wig.tsx`):**
- Coach Coached / Closes — already tappable, leave as is (just upgraded labels).
- SA Lead Measures table → Referral Asks count and 5-Class Packs count: tap → list of the actual intros / milestone rows behind the number (member name, date, source).
- First Visit Experience: each coach's score is already drillable to scorecards — confirm coverage; leave business logic alone.
- Milestones / Deploy section: tap any per-person count (referrals brought, packs gifted, milestones logged) → list of rows.
- Referral Ask Tracker: tap any per-SA number → ask list.

**Studio (`src/pages/Recaps.tsx` and children):**
- `PerSATable.tsx` (Runner Stats) — every numeric per-SA cell (intros run, showed, sold, no-shows, close%) tappable → people behind it.
- `BookerStatsTable.tsx` (Booker Stats) — every per-SA numeric cell tappable.
- `OutreachTable.tsx` — per-SA outreach counts tappable.
- `PerCoachTable.tsx` — Coached / Closes already tappable; add Close% (opens combined view = coached list with SALE highlighted).
- `LeadSourceChart` — already supports drill via bookedPeople/showedPeople/soldPeople. Confirm a tap surface exists; if not, add it.
- `VipClassPerformanceTable.tsx` — per-session attendance / conversion counts tappable to attendees.

Standard cell pattern (44 px tap target, visible hover, OTF Orange numerals on close-style metrics, disabled when zero):

```tsx
<button type="button" disabled={n === 0}
  onClick={() => openDrill({...})}
  className="w-full min-h-[44px] px-3 cursor-pointer hover:bg-muted/40
             hover:underline disabled:cursor-default disabled:hover:bg-transparent
             disabled:hover:no-underline">
  {n}
</button>
```

### 5. Verification

- Open James → Coached in both WIG and Studio for May. Alexa Brodsky should now read **Booked 2nd · → SALE via 2nd intro** (not `—`), Sarah and Mehmet still read **SALE**, footer math unchanged.
- Open every numeric cell across PerSA, Booker, Outreach, PerCoach, VIP Class, Referral, Milestones tables — each opens a person list with names, dates, sources, and result tags.
- Confirm no behavior change in totals or close-rate math (display layer + canon helpers only).

## Out of scope

- The bigger WIG-vs-Studio coached/closes reconciliation (already noted as a follow-up).
- Any change to commission attribution or DB schema.

## Files expected to change

- new: `src/lib/intros/resultLabels.ts`
- new: `src/components/dashboard/PersonListDrillDown.tsx` (or extend `CoachAttributionDrillDown.tsx` and re-export)
- edit: `src/components/dashboard/CoachAttributionDrillDown.tsx`
- edit: `src/pages/Wig.tsx`
- edit: `src/pages/Recaps.tsx` (if needed for wiring)
- edit: `src/components/dashboard/PerCoachTable.tsx`
- edit: `src/components/dashboard/PerSATable.tsx`
- edit: `src/components/dashboard/BookerStatsTable.tsx`
- edit: `src/components/dashboard/OutreachTable.tsx`
- edit: `src/components/dashboard/LeadSourceChart.tsx` (only if drill surface missing)
- edit: `src/components/admin/VipClassPerformanceTable.tsx`
- edit: `src/components/dashboard/ReferralAskTracker.tsx`
- edit: `src/components/dashboard/MilestonesDeploySection.tsx`
- edit: `src/lib/intros/close-detection.ts` (route through new helper)
