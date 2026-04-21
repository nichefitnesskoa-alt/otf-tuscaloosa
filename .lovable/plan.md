

## Goal

Friends brought by VIP attendees should NOT show the **VIP Class Intro** badge and SHOULD receive a questionnaire (red **No Questionnaire** chip until sent). Only the direct VIP attendees (`lead_source = "VIP Class"`) get the purple VIP badge and **No Q Needed** suppression.

## Root cause

In `src/features/myDay/useUpcomingIntrosData.ts` line 238, the previous build set `isVipClassIntro` to true for any source starting with `"vip class"` — which includes both `VIP Class` AND `VIP Class (Friend)`. That flag drives both the purple badge and the "No Q Needed" suppression in `IntroRowCard.tsx`. Friends got swept in by accident.

Friends are real first intros from someone outside the VIP context — they need a questionnaire like any other 1st intro.

## Changes

### 1) `src/features/myDay/useUpcomingIntrosData.ts` (line 238)
Tighten the derivation to exact match on `"VIP Class"` only — exclude `"VIP Class (Friend)"`:

```
const src = (b.lead_source || '').toLowerCase();
isVipClassIntro: src === 'vip class',
```

### 2) `src/features/myDay/IntroRowCard.tsx` (badge area, lines ~387–404)
Remove the dual-badge branch added in the previous build. Friends now fall through to the standard `1st Intro` badge path automatically since `isVipClassIntro` is false for them. No special VIP friend handling needed.

Resulting behavior:
- `lead_source = "VIP Class"` → purple **VIP Class Intro** badge, **No Q Needed** chip
- `lead_source = "VIP Class (Friend)"` → standard **1st Intro** badge, red **No Questionnaire** chip until sent
- All other sources → unchanged

### 3) Questionnaire auto-creation
Already handled — `intro_questionnaires` rows are auto-provisioned by DB trigger for first intros regardless of source. Friends already have questionnaire records; the UI just needs to stop suppressing the prompt. The above two changes accomplish that.

## Files touched

- `src/features/myDay/useUpcomingIntrosData.ts` — tighten `isVipClassIntro` to exact `"vip class"` match.
- `src/features/myDay/IntroRowCard.tsx` — remove the friend dual-badge branch; let friends use the standard 1st Intro path.

No DB changes. No RLS changes. No effect on attribution, VIP isolation, or conversion math.

## Downstream effects

- VIP friend bookings (e.g. PJ's Coffee friends) immediately show the standard **1st Intro** badge and red **No Questionnaire** prompt until the SA sends one.
- Direct VIP attendees keep their purple **VIP Class Intro** badge and **No Q Needed** suppression — unchanged.
- `Send Q` / `Resend Q` actions in the card already work for friends since their questionnaire records exist — no extra wiring needed.
- Inline `VIP class: …` linking in `IntroCard.tsx` is unaffected; SAs can still attach a session for attribution if relevant.
- Attribution math, scoreboard exclusions, and VIP isolation rules untouched — those depend on `vip_session_id` / `isVipBooking`, not the visual flag.

