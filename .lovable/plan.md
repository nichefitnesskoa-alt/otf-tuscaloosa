## Coach View — default to "My Intros" with orange toggle

In `src/pages/CoachView.tsx`, replace the current `Select` (All Coaches / per-coach) with a 2-option segmented toggle:

- **My Intros** (default for any user with a name in `coach_name`)
- **All Intros**

Behavior:
- Default `coachFilter` = `user?.name` when that name appears in `allCoachNames`; otherwise `"all"`.
- Toggle state persists via local state (no URL change).
- Visual: pill-style segmented control. Selected segment = solid OTF Orange (`bg-primary text-primary-foreground`). Unselected = light orange tint (`bg-primary/15 text-primary hover:bg-primary/25`). Border around the whole control in `border-primary/40`. Min-height 44px.
- Admins/Both still see the toggle (My Intros = their own name's intros if they coach, else only "All Intros" shows). For SAs viewing CoachView this is moot — they don't access it.

The standalone "Open coach page →" link is already removed (prior build) — no change needed.

## Universal "tab/toggle" orange treatment

Create a small shared component `src/components/ui/SegmentedToggle.tsx` (thin wrapper around buttons, not shadcn Tabs) so future toggles share styling. Then update existing tab/segment surfaces to use the orange-on / light-orange-off scheme:

Confirmed surfaces to update (all existing `Tabs`/segmented controls):
- `src/features/followUp/FollowUpTabs.tsx` (5 follow-up category tabs)
- `src/features/myDay/MyDayPage.tsx` tab bar (Intros / Follow-Up / Scripts / New Leads)
- `src/components/scorecard/WigFirstVisitSection.tsx` graph toggle (Self Evals / Formal Evals)
- `src/features/pipeline/PipelinePage.tsx` Standard / VIP tabs
- `src/features/vips/VipsPage.tsx` internal tabs
- `src/pages/Wig.tsx` any segmented controls

Style rule applied uniformly via a Tailwind variant on shadcn `TabsTrigger`:
- `data-[state=active]`: `bg-primary text-primary-foreground border-primary`
- default (inactive): `bg-primary/15 text-primary hover:bg-primary/25 border-primary/30`
- container: `bg-transparent gap-1`

Done by extending `tabs.tsx` variant classes (or wrapping with a `className` constant `ORANGE_TABS_TRIGGER` exported from a shared util) so we don't fork shadcn. Page-level tab headers remain visually distinct from their content sections (which keep the current card/border styling — no orange tint on content panels).

**CONFIRM THIS VALUE:** Apply the orange treatment to ALL `TabsTrigger` instances project-wide via a single shadcn override, OR only to the explicit list above? Default plan = override globally so every tab in the app reads consistently. Say "scoped only" if you'd rather restrict.

## Bottom-nav reordering

Update `src/components/BottomNav.tsx` ordering. Same set of items, new sequence:

**Admin (Koa):**
`My Day → Coach View → Studio → WIG → Own It → VIPs → Text My Intros → Pipeline → Admin`

**Both (e.g. Georgia):**
`My Day → Coach View → Studio → WIG → Own It → VIPs → Text My Intros → Pipeline`

**SA:**
`My Day → Studio → WIG → Own It → VIPs → Pipeline`
(VIPs moves next to Own It; Pipeline goes to the end.)

**Coach (mobile-first single nav):** unchanged set, but reorder to keep consistency:
`Coach View → Studio → WIG → Own It → VIPs → Text My Intros`

## Files touched

- `src/pages/CoachView.tsx` — replace Select with orange segmented toggle, default to user's name.
- `src/components/BottomNav.tsx` — reorder per role.
- `src/components/ui/tabs.tsx` — extend `TabsTrigger` variants with orange on/off states (or add an exported class constant).
- (no logic changes elsewhere — purely presentational sweep across existing Tabs usages)

## Verification

- Log in as Georgia (Both) → CoachView defaults to her name; toggle flips to "All Intros" and back; both states orange-correct.
- Log in as Koa → CoachView toggle works; nav order matches Admin spec; VIPs sits between Own It and Text My Intros; Pipeline sits before Admin.
- Log in as a regular SA → no Coach View; VIPs next to Own It; Pipeline at end.
- Open Follow-Up tabs, My Day tabs, WIG Self/Formal Eval toggle — active tab solid orange, others light-orange tinted.
- Tap a tab → active state updates, no layout jump.
