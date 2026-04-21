

## Goal

On the My Day intro card collapsed header row, show the lead source as an always-visible badge (next to the 1st/2nd/VIP badge), and remove the Shoutout badge from that same collapsed row. Both changes apply only to the collapsed summary header — expanded card content stays untouched.

## Root cause / current state

In `src/features/myDay/IntroRowCard.tsx` the collapsed header (lines ~387–404 area) currently renders the intro-type badge (`1st Intro` / `2nd Intro` / `VIP Class Intro`) and a Shoutout badge, but never renders the lead source. Lead source only appears once the card is expanded (inside `IntroCard.tsx`'s editable header). At-a-glance scanning of the day requires knowing the source without expanding.

## Changes

### 1) `src/features/myDay/IntroRowCard.tsx` — collapsed header badge row

- **Add**: Render `<LeadSourceTag source={item.leadSource} />` from `src/components/dashboard/IntroTypeBadge.tsx` immediately after the existing `IntroTypeBadge` in the collapsed header. Only render when `item.leadSource` is truthy. Use the same `text-[10px] px-1.5 py-0 h-4` sizing already used by sibling badges so the row height does not shift.
- **Remove**: The Shoutout badge currently rendered in the collapsed header row. Delete only that badge node — leave all Shoutout logic, the `shoutoutConsent` prop, and any Shoutout display inside the expanded card body fully intact.

No other badge in the collapsed row changes. No layout, spacing, color, or expand/collapse behavior changes. The existing `LeadSourceTag` component already provides:
- Consistent color mapping per source (IG DM pink, Referral emerald, Web Lead blue, VIP purple, etc.)
- Short labels (`IG DM`, `Referral`, `Web Lead`, `VIP`, `Lead Mgmt`, `Personal`, `Biz Partner`, `Event`, etc.) so the badge fits on the single header line at the current viewport.

So no new component, no new color decisions, no invented labels.

### 2) Nothing else touched

- `IntroCard.tsx` (expanded body): unchanged — lead source inline editor and Shoutout display remain.
- `useUpcomingIntrosData.ts`: unchanged — `leadSource` is already on `UpcomingIntroItem`.
- VIP detection, questionnaire status, "No Q Needed" rules, attribution, role permissions: unchanged.

## Files touched

- `src/features/myDay/IntroRowCard.tsx` — add `LeadSourceTag` to collapsed header; remove Shoutout badge from collapsed header.

## Downstream effects

- SAs can see the lead source of every intro at a glance on the My Day list without expanding cards.
- Collapsed row is one badge lighter (Shoutout removed) and one badge heavier (Lead Source added) — net same density, cleaner signal.
- Shoutout information is preserved everywhere it currently appears in the expanded card body — only the duplicate collapsed-row chip is removed.
- No data writes, no DB changes, no RLS changes, no role permission changes.
- No effect on attribution, conversion math, VIP isolation, or questionnaire flow.
- Central Time conventions untouched.

