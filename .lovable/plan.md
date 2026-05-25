## Why the 3 "real issues" exist

Funnel uses **global** "did this member ever pass a 2nd intro?" to suppress 1st intros, but funnel's `second.showed` only counts 2nd intros that ran **inside the selected date range**. When a member's 2nd intro ran in a prior period and their 1st intro lands in the current range, the suppression fires but no offsetting +1 lands in `second.showed`. Net: Scoreboard/Per-SA = 24, Funnel = 21, three orphan drift entries with no pair partner.

This is the same definitional behavior as the in-range pairs — it just straddles a date boundary.

## Fix

Update the expected-pair tagger in `src/lib/metrics/sourceMembership.ts` so a `first_intro_suppressed_by_passed_second` drift is tagged `isExpectedPair = true` whenever the member has **any** passed 2nd intro globally — not only when an offsetting `second_intro_outside_funnel_first` exists in the same range.

### Logic
1. Build a `Set<memberKey>` of members who have at least one ran 2nd intro globally (any date, `didIntroActuallyRun` true, `originating_booking_id` present).
2. In the existing tagging loop:
   - Keep current behavior for in-range matched pairs.
   - Additionally: any `first_intro_suppressed_by_passed_second` whose member is in that global set → mark `isExpectedPair = true`.
3. `second_intro_outside_funnel_first` rows continue to pair only when an in-range 1st-suppressed partner exists (no change).

### What stays a real issue
- `missing_intro_owner`
- `excluded_sa_owner`
- `orphan_parent_excluded`
- `no_ran_run`
- `unknown`
- Any `first_intro_suppressed_by_passed_second` where the member somehow has no passed 2nd (data corruption) — still real

### UI
No changes to `MetricsConsistencyAlert.tsx`. Header text ("3 real issues · 4 normal pairings") will recompute to "0 real issues · 7 normal pairings" for the current range and the alert flips to the green/success tone.

## Files touched
- `src/lib/metrics/sourceMembership.ts` — extend expected-pair tagging

## Verification
- Current screenshot range: drift should show 0 real / 7 normal, alert turns green.
- Any range where a 1st-suppressed drift exists but member truly has no passed 2nd → still flagged red (safety net intact).
- Totals (24/24/21) unchanged — this is presentation-only.
