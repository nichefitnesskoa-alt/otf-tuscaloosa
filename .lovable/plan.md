

# Remove Referral Ask from Coach Card & WIG

## Summary
Remove the referral ask field from Coach View post-class debrief and its corresponding metric from the WIG Coach Lead Measures table. Three files changed.

## File Changes

### 1. `src/components/coach/CoachIntroCard.tsx`
- Remove `referralAsked` and `referralNames` state declarations (lines 77-78)
- Remove `handleReferralAsked`, `handleReferralNamesChange`, and `createReferralLeads` functions (lines 166-200)
- Remove the entire referral ask UI block (lines 282-294)
- Post-class section will contain exactly: shoutout start, shoutout end, got curious, member intro + text, pairing plan

### 2. `src/pages/Wig.tsx`
- **SA Lead Measures**: Keep referral asks column — this tracks SA referral asks via `coach_referral_asked` on `intros_booked` (SA-facing metric, stays)
- **Coach Lead Measures table**: No referral column exists in the coach table currently (already correct — columns are Coached, Shoutout %, Got Curious %, Intro to Member %, Pairing %, Close %)
- No changes needed to WIG coach table

### 3. No database migration needed
- `coach_referral_asked` and `coach_referral_names` columns stay in `intros_booked` for SA use
- No `coach_wig_summary` view exists as a DB view — it's computed client-side in Wig.tsx, and already doesn't include referral_ask_rate for coaches

## Technical Details
- The `createReferralLeads` function in `CoachIntroCard.tsx` is duplicated from `CoachPrePostClass.tsx` — removing it from CoachIntroCard doesn't affect SA-side referral lead creation
- The SA Lead Measures table in WIG reads `coach_referral_asked` from `intros_booked` grouped by `booked_by` — this is an SA attribution metric and stays unchanged

