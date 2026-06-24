## Goal

The "Follow on Instagram" action (all listed handles) becomes the **minimum requirement to be eligible to win**. Every other action is bonus entries on top. This needs to be obvious on the entry page AND enforced in the draw.

## Changes

### 1. Entry page copy & visual hierarchy (`GiveawayEntryForm.tsx`)

- Add a prominent banner above the action grid:
  > **Required to win: Follow all accounts in Step 1. Everything else is bonus entries.**
  Orange-bordered, same treatment as the existing "Every prize has its own winner" banner.
- Action #1 ("Follow on Instagram") card gets a "REQUIRED" pill in the header (red/orange) and a subtitle: *"You must complete this to be eligible — non-negotiable."*
- Actions #2–#N (post engagement, story share, class story, partner visits) get a "BONUS ENTRY" pill instead of just the number. Description prefix changes to *"Optional — earn an extra entry."*
- When IG follow is not yet complete, show a small inline locked notice under the bonus cards: *"Complete Step 1 to make these count."* (They can still tick them — they just won't count toward eligibility until #1 is done.)

### 2. Draw eligibility enforcement (`weightedDraw.ts` + callers)

- Extend `DrawEntry` with `action_instagram_follow: boolean`.
- `eligibleEntries` filters out anyone where `action_instagram_follow !== true`, in addition to the existing `total_entries > 0` check.
- Update the 3 call sites that build `DrawEntry[]` (`GiveawayAdminPage.tsx`, `PartnerViewPage.tsx`, `DrawWinner` consumers) to pass the flag through. Underlying row already has it from `useGiveawayEntries`.
- `eligibleCount` shown on Admin/Partner views now reflects the new rule automatically.

### 3. Admin/Partner clarity (small)

- In `GiveawayAdminPage.tsx` header line, change "X eligible" tooltip/label to: *"X eligible (completed required IG follow)"*. No layout change.

## Out of scope

- No DB migration. `action_instagram_follow` already exists on `giveaway_entries`.
- No change to bonus computation — bonus counters still tally every action so participants see their effort. Eligibility is a separate gate.
- Public-facing pages keep OTF brand (#FF6F0D / #0A0A0A / #FDF7EA); the entry form already uses #E8540A which is in use here, no color rework.

## Files touched

- `src/features/giveaway/components/GiveawayEntryForm.tsx`
- `src/features/giveaway/lib/weightedDraw.ts`
- `src/features/giveaway/GiveawayAdminPage.tsx`
- `src/features/giveaway/PartnerViewPage.tsx`

## Verification

- Live entry page shows the new required banner + REQUIRED pill on Step 1 + BONUS pills on 2+.
- DB: pick any entry with `action_instagram_follow = false` and `bonus_entries > 0` → confirm it is excluded by `eligibleEntries`. Admin "eligible" count drops accordingly and matches Partner view.
