## Two issues, two fixes

### Issue 1 — Partner Deck settings audit
The "Giveaway Title" radio in the Partner Deck sidebar writes `title_format` and `custom_title` correctly, but **the Slide 1 cover ignores both fields**. `SlideCover` in `PartnerDeckPage.tsx` (lines 281–285) hardcodes:

- Big bone-white title → `studio.deck_s1_title1 || 'Cross-Collab Raffle'`
- Orange line → always `'OrangeTheory Fitness × <partners joined by ×>'`
- Sub-body → hardcoded "A giveaway built around the best local businesses…"

So picking "Auto: Brand Only" or "Custom Title" updates the entry form (`GiveawayEntryForm` does read `getGiveawayTitle`) but the deck preview never moves.

Every other Partner Deck setting I audited works:
- Winner Draw Rules → drives `getDeckSlide2(winner_structure)` on Slide 2 ✓
- Duration → countdown + Live status display ✓
- Go Live / End Giveaway → updates `goes_live_at` ✓
- All deck copy fields (s2–s8) → consumed by their slides ✓
- Partner Deck Content sub-panel (contact, anchor, ask copy) → all flow through ✓

**Fix (per your answer — keep manual override):**
Rewrite `SlideCover` to derive title from `title_format`:

1. Compute `autoTitle = getGiveawayTitle(slug, partners, studio.title_format, studio.custom_title)`.
2. Big title (`title1`):
   - If `deck_s1_title1` is set → use it (manual override, unchanged behavior for anyone who customized).
   - Else if `title_format === 'auto_combined'` → `'Cross-Collab Raffle'` (keeps current default for the existing flow that has no partners-in-title concept on slide 1).
   - Else (`auto_studio_only` or `custom`) → use `autoTitle`.
3. Orange line (`orangeLine`):
   - If `title_format === 'auto_combined'` → keep current `Brand × Partner × Partner` line.
   - If `auto_studio_only` → hide the orange line entirely (it's redundant with the big title).
   - If `custom` → hide the orange line (custom title speaks for itself).
4. Keep the "A giveaway built around the best local businesses…" sub-line in all cases (it's brand voice, not title).
5. Update the Slide 1 editor in `PartnerDeckAdminPage.tsx` to note that the manual `deck_s1_title1` override now wins over the title format setting, with a "Clear override" button next to the field.

No DB migration needed — `title_format`, `custom_title`, `deck_s1_title1` already exist.

---

### Issue 2 — 2nd-intro drift noise

**You're right.** Today's alert flags two things as "offenders" that are actually *normal expected behavior* whenever a 2nd intro exists:

- `first_intro_suppressed_by_passed_second` — Funnel intentionally suppresses the 1st when the same member already passed a 2nd.
- `second_intro_outside_funnel_first` — Funnel intentionally counts the 2nd in its `second.showed` row, which Scoreboard (1st-only) doesn't.

These two always come in matched pairs and **cancel out at the totals level** (your screenshot: 4 = 4 = 4). They're definitional differences between surfaces, not bugs.

**Fix (per your answer — add a toggle):**

1. In `sourceMembership.ts`, tag each `DriftItem` with `isExpectedPair: boolean`. A row is an "expected pair" when:
   - reasonCode is `first_intro_suppressed_by_passed_second` AND the member has a paired `second_intro_outside_funnel_first` row in the same range, OR vice versa.
2. In `MetricsConsistencyAlert.tsx`:
   - Compute `realOffenders = drift.filter(d => !d.isExpectedPair)` and `pairCount = drift.length - realOffenders.length`.
   - **Top-line banner copy changes based on `realOffenders.length`:**
     - 0 real offenders → green/neutral card: "Scoreboard, Per-SA, and Funnel all agree. N normal 2nd-intro pairings hidden." (no longer screams red).
     - >0 real offenders → red alert keeps current treatment, count shows `realOffenders.length` only.
   - Add a `<Button variant="ghost">Show {N} normal 2nd-intro pairings</Button>` toggle. Default collapsed. When expanded, render the paired rows beneath the real offenders, dimmed, with a "Normal — 2nd intro present" badge instead of a fix-needed badge.
3. Header count "4 affected bookings" → "0 real issues · 4 normal 2nd-intro pairings" when nothing is wrong.

This kills the recurring noise the moment a 2nd intro exists while keeping full transparency one click away. Genuine drift (missing intro_owner, orphan parent excluded, etc.) still surfaces immediately.

---

### Files to change

- `src/features/giveaway/PartnerDeckPage.tsx` — rewrite `SlideCover` title/orange-line logic
- `src/features/giveaway/PartnerDeckAdminPage.tsx` — note manual override + "Clear override" affordance for `deck_s1_title1`
- `src/lib/metrics/sourceMembership.ts` — add `isExpectedPair` tagging
- `src/components/dashboard/MetricsConsistencyAlert.tsx` — split rendering by real vs paired, add toggle, recompute headline

No DB migrations. No metric definition changes — surfaces still count what they count today.
