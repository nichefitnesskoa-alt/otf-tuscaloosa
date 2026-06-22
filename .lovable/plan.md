# Clarify OTF prize as "One Month Free Membership"

Replace the ambiguous "Free Membership" / "Membership" wording on every giveaway-facing surface so entrants and partners see the actual prize: one month, not an indefinite membership.

## Changes (frontend copy only)

1. **`src/features/giveaway/components/PrizeShowcase.tsx`** (line 19)
   - `prize: 'FREE MEMBERSHIP'` → `prize: 'ONE MONTH FREE MEMBERSHIP'`
   - This drives both the entry page prize grid and any preview that renders PrizeShowcase.

2. **`src/features/giveaway/components/DrawWinner.tsx`** (line 38)
   - Prize label `` `${getParticipantStudioName(studioSlug)} Membership` `` → `'One Month Free Membership'`
   - (Studio name still appears via the page/section context; the per-prize row is about what is won.)

3. **`src/features/giveaway/components/SpinWheel.tsx`** (line 41)
   - Same swap as DrawWinner: prize label → `'One Month Free Membership'`.

4. **`src/features/giveaway/lib/winnerStructure.ts`** (line 20)
   - Subtitle for the `single` option:
     `'One person wins the OrangeTheory Fitness membership and all partner prizes.'`
     → `'One person wins one month of free OrangeTheory Fitness membership and all partner prizes.'`

## Intentionally NOT changed

- **`PartnerDeckPage.tsx` line 380** already says "One month free membership" — leave as-is.
- **`partnerDeckDefaults.ts` line 21** and **`PartnerDeckSettings.tsx` lines 95, 109** reference "OTF membership" as the *value anchor* for partner gift matching, not as the prize description. Renaming there would muddle the partner-pitch math. Leave as-is.

## Verification

- Visit `/giveaway/tuscaloosa` (gate + post-entry) — prize grid OTF card reads "ONE MONTH FREE MEMBERSHIP".
- Visit `/giveaway/tuscaloosa/admin` Draw view in both single and per-prize modes — OTF row reads "One Month Free Membership".
- Confirm desktop grid + mobile vertical stack both reflect the new label (PrizeShowcase change covers both).
- Partner deck slide listing the OTF anchor still reads "One month free membership" (unchanged).
