

## Goal

Show the **VIP Class Intro** badge and **No Q Needed** indicator on My Day intro cards as soon as the lead source identifies the intro as VIP — even if the booking hasn't yet been linked to a specific `vip_session_id`. Friends brought by VIP attendees still count as 1st intros, but should also display the VIP context badge.

## Root cause

In `src/features/myDay/useUpcomingIntrosData.ts` (line 238), `isVipClassIntro` is only set true when **both** conditions hold:
- `lead_source` starts with `"VIP Class"`
- `vip_session_id` is set

The PJ's Coffee bookings (and their friends) have the right `lead_source` but `vip_session_id` is still null. So the card falls back to the generic "1st Intro" + red "No Questionnaire" treatment, which is exactly what the screenshot shows.

The friend variant uses `lead_source = "VIP Class (Friend)"` — also already a VIP source — and should get the VIP visual treatment too while still being labeled "1st Intro" semantically (no `isSecondIntro` change).

## Changes

### 1) `src/features/myDay/useUpcomingIntrosData.ts`
Loosen the `isVipClassIntro` derivation so the visual VIP context appears the moment the source says VIP, regardless of session linkage:

```
isVipClassIntro: (b.lead_source || '').toLowerCase().startsWith('vip class')
```

This matches both `VIP Class` and `VIP Class (Friend)`. No other field affected. `vip_session_id` linkage continues to drive real attribution; this flag is purely the visual/at-a-glance signal.

### 2) `src/features/myDay/IntroRowCard.tsx` — summary header bar (lines ~387–404)
Two small adjustments so the badge area communicates the user's mental model on first glance:

- For VIP Class **Friend** bookings: keep the **`1st Intro`** badge (since friends are real first intros), and *also* show the **`VIP Class Intro`** purple badge next to it. Currently it shows only one or the other.
- For non-friend VIP class intros: keep current single `VIP Class Intro` badge as today.

Logic:
```
const isVipFriend = (item.leadSource || '').toLowerCase() === 'vip class (friend)';
// render:
//   if isVipClassIntro && !isVipFriend → just "VIP Class Intro"
//   if isVipClassIntro && isVipFriend  → "1st Intro" + "VIP Class Intro"
//   else                                → existing "1st"/"2nd" badge
```

The "No Q Needed" treatment already keys off `item.isVipClassIntro || item.isSecondIntro` (line 397), so once the flag flips true these cards will automatically show **`No Q Needed`** in muted gray instead of the red **`No Questionnaire`** chip — no further change needed.

### 3) Surface `leadSource` to the card
`UpcomingIntroItem` already exposes `leadSource`, so the friend check works without a type change.

## Files touched

- `src/features/myDay/useUpcomingIntrosData.ts` — broaden `isVipClassIntro` derivation.
- `src/features/myDay/IntroRowCard.tsx` — show `1st Intro` + `VIP Class Intro` together for VIP friends; keep solo VIP badge for direct VIP attendees.

No DB changes. No RLS changes. No effect on attribution math, conversion funnel, or VIP isolation rules — those still depend on the actual `vip_session_id` and the canonical `isVipBooking` predicate. This change is purely the at-a-glance label and the suppression of the red questionnaire chip.

## Downstream effects

- PJ's Coffee bookings (and any future VIP-source bookings) immediately show the purple **VIP Class Intro** badge in the My Day list and stop showing red **No Questionnaire** prompts.
- Friends of VIP attendees show **1st Intro · VIP Class Intro** together, accurately reflecting that they are first-time intros that came in through a VIP class context.
- Inline VIP class linking (the `VIP class: …` affordance added in the previous build inside `IntroCard.tsx`) is unaffected — SAs can still attach the specific past VIP session when ready, which then powers attribution and reporting.
- No retroactive data writes. Central Time conventions preserved.

