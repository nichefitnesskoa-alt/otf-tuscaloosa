## Findings

### 1. VIP purchases missing (Jill, Aravind, Madison)
All three have `intros_booked` rows linked to `vip_session_id` and `intros_run` rows that closed as memberships — but with `result_canon` values of `PREMIER` / `BASIC`, **not** `SALE`. The "Joins from VIP" query in `VipPerformanceDashboard.tsx` filters `.eq('result_canon', 'SALE')`, so any intro-path purchase whose canon is a membership tier (BASIC / PREMIER / ELITE / PREMIUM / etc.) is silently dropped. Only the registration-side `outcome = 'purchased'` path catches Aravind; Jill and Madison are invisible because their registration outcomes are still `booked_intro` / `showed`.

### 2. Coach close % wrong (Koa 33% vs expected 25%)
`Coached & Closes` uses two different denominators:
- **Coached**: counts showed first-intro bookings (Koa = 4)
- **Close %**: uses `cl.total` from `coachCloseMap` — counts of `intros_run` rows that aren't NO_SHOW/UNRESOLVED/VIP_CLASS_INTRO and have a `coach_name` on the run. Some of Koa's 4 coached intros don't produce a counted run (missing run row, filtered VIP_CLASS_INTRO, or coach_name mismatch), so denominator = 3 → 1/3 = 33%.

User expectation: Close % should always be `closes ÷ coached`, never a separate denominator.

### 3. First Visit Experience needs auto intro counts
Currently shows `Scored / L3 / Avg` per coach. User wants:
- Total intros each coach actually ran (denominator)
- Scored count broken out as Self vs Formal
- Gap between self avg and formal avg
- Move the section above "Ask for a referral" (which lives in Section 2)

### 4. Referral button rename + clear goal
"Ask later" should be "Reached out after" and behave like the existing `handleDoneLater` (mark asked = true). Section needs a one-line goal explaining why we ask every new member.

---

## Plan

### A. Fix VIP "Joins from VIP" count — `src/features/vips/VipPerformanceDashboard.tsx`
Replace the `.eq('result_canon', 'SALE')` filter with a broader sale check that matches the rest of the codebase:
- Accept `result_canon IN ('SALE','BASIC','PREMIER','ELITE','PREMIUM','PREMIER_PLUS')` OR use the existing `isMembershipSale(result)` helper from `src/lib/sales-detection.ts` on the `result` text.
- Re-dedupe by normalized member name unioned with the registration `purchased` set so Jill, Aravind, and Madison all surface.
- Same fix applied to `intros_booked_from_vip` — already counts everyone with a VIP-linked booking, but verify Jill/Aravind/Madison appear (they should since they have `vip_session_id`).

### B. Align Coach Close % denominator — `src/pages/Wig.tsx`
In the `Coached & Closes` table, change `closeRate` from `cl.closed / cl.total` to `cl.closed / wk.coached`. This makes the percentage match the visible "Coached" column, e.g. Koa = 1/4 = 25%. Keep close attribution logic (VIP coach resolution, second-intro pull-forward) unchanged.

### C. Expand First Visit Experience auto-counts — `src/components/scorecard/WigFirstVisitSection.tsx`
For each coach in the date range, also fetch ran first-intros (reuse the same logic from WIG: `intros_booked` + `intros_run` joined, exclude NO_SHOW/UNRESOLVED, exclude VIP, dedupe to first-intros). Show columns:
- **Coach**
- **Intros Ran** (auto from intros_run)
- **Self Scored** (count where `eval_type = 'self_eval'`) + avg
- **Formal Scored** (count where `eval_type = 'formal_eval'`) + avg
- **Gap** (formal avg − self avg, color-coded)
- **L3** count

Keep the top three Level tiles unchanged.

### D. Reorder WIG sections — `src/pages/Wig.tsx`
Move `<WigFirstVisitSection />` from after Section 2 to live **between the Coach — Coached & Closes card and the Referral Ask Tracker**, i.e. directly above `<ReferralAskTracker />` inside Section 2's container. Order becomes:
1. SA Lead Measures
2. Coach — Coached & Closes
3. **First Visit Experience** (moved)
4. Ask for a referral
5. Milestones & Deploy

### E. Referral Ask Tracker copy + button — `src/components/dashboard/ReferralAskTracker.tsx`
- Replace subtitle with a clear goal: "Every new member is your warmest lead. Ask each one for a referral within 24 hours of their join — at POS if possible, or by text after."
- Rename the secondary button "Ask later" → **"Reached out after"** with a `Check` icon, and wire it to `handleDoneLater` (i.e. it marks the row as asked immediately rather than just deferring).
- Remove the intermediate `followupPending` state path for new clicks (existing rows already in pending state still show "Done — asked them"). Optional: collapse to a single "Asked at POS" + "Reached out after" pair always.

---

## Out of scope
- Schema changes — all four fixes are presentation/query-layer only.
- Adding new outcome values to `vip_registrations`.
- Changing the canon enum on `intros_run` (we widen the read-side check instead).