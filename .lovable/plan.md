## Scope
All changes in `src/features/wig/soml/SomlSection.tsx` (the Referrals / Upgrades / Sales block on the WIG page). Presentation-only — no metric math, no attribution, no DB writes.

## 1. Hover tooltips on every button
Wrap each interactive element in a shadcn `Tooltip` so hovering explains exactly what it does. Buttons covered:

- **HeroTile pencil (Referrals / Upgrades / Sales top tiles)** → "Edit the team-wide goal for {metric} this window (admin)."
- **"+" log button next to each hero tile** (opens `LogDialog`) → "Log a new {referral / upgrade / sale} for an SA."
- **Window/date edit button** → "Change the start and end date of this WIG window (admin)."
- **Per-SA row pencil (leaderboard cell)** → "Override this SA's {metric} goal. Overrides pull the default down for the other SAs so the team total still hits the goal."
- **Per-SA row when not admin** → tooltip on the number cell: "{r[k]} of {tgt} — {metric}."

Non-button hover helpers (same tooltip primitive) on the column headers so the definitions live where the eye lands:

- **Referrals header** → "The SA who booked a person you talked to gets credit when that person refers someone else who buys a membership."
- **Upgrades header** → "Credit to the SA who talked a current member into upgrading their membership tier."
- **Sales header** → "Credit to the SA who ran the intro that closed — even if the buyer was originally a referral."

## 2. Definition legend under the hero tiles
Add a small always-visible legend row above the leaderboard (below the existing "Default per-SA target" line) so it's readable without hovering. Three short lines, one per metric, matching the tooltip copy above. Muted foreground, 11px, one line each.

## 3. Wider / bigger metric columns, narrower SA name
Rework the leaderboard table layout:

- Add explicit widths: `SA` column ~110px, each of `Referrals / Upgrades / Sales` `w-1/4` (roughly 30% each) so the metric columns dominate.
- Bigger current-value number: bump `font-semibold` → `text-2xl md:text-3xl font-black tabular-nums` for `{r[k]}`.
- Bigger target: `/ {tgt}` becomes `text-sm text-muted-foreground` (up from 10px), placed on the same baseline.
- Thicker pace bar under each cell: `h-2` (was `h-1.5`) and full-width of the cell.
- Increase row vertical padding so the taller numbers breathe.
- SA name cell: `text-sm font-semibold truncate` in the tighter column.

Mobile note: table stays horizontally scrollable if the viewport is narrow; the number size and column ratio stay the same so the leaderboard reads like the reference screenshot at desktop widths.

## Technical details
- Import `Tooltip, TooltipContent, TooltipProvider, TooltipTrigger` from `@/components/ui/tooltip`. Wrap the whole `SomlSection` return in a single `TooltipProvider` so every trigger shares config.
- No changes to `useSomlData`, targets, redistribution logic, or any hook.
- Uses existing tokens only (`text-muted-foreground`, `text-foreground`, `font-black`, `tabular-nums`); no new colors.

## Files touched
- `src/features/wig/soml/SomlSection.tsx` (only)

## Out of scope
- Behavior of Save / Upgrade / Refer buttons on the outreach list page (those were already explained in chat).
- Any change to how referrals / upgrades / sales are counted or attributed.
