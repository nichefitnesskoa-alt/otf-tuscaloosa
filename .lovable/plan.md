## Three small changes on the Studio tab

### 1. Remove the red "Metrics disagree" section
The drift alert card at the top of the Studio tab is noisy and not actionable for staff. Remove it from `src/pages/Wig.tsx` (the `<SourceMembershipPanel />` / drift card render). Leave the underlying `computeSourceMembership` helper in place in case we want it back later as an admin-only debug view, but stop rendering it.

### 2. Add total-journey disclaimer to Studio Scoreboard
The Studio Scoreboard (Intros Run / Sales / Close Rate tiles) uses the same total-journey logic as Coach Stats: sales count if any booking in the chain closes, even when the closing 2nd intro is not in "Intros Run". Add a small `text-[11px] text-muted-foreground` line under the "Studio Scoreboard" header, parallel to the existing "Excludes VIP events" footer:

> "Close rate is total journey. A sale counts on its first intro's chain, even when the 2nd intro that closed it is not in Intros Run."

No metric or logic change.

### 3. Fix Close% display when Coached = 0 but Closes ≥ 1
In `src/components/dashboard/PerCoachTable.tsx`, the row math is:
```
closeRate = coached > 0 ? (closes / coached) * 100 : 0
```
So Nathan (0 coached, 1 close via 2nd-intro journey credit) shows `0%` in red, which reads as a failure even though he closed.

Change: when `coached === 0 && closes > 0`, display `100%` in the success color (same green as a normal 100%). This matches the total-journey framing already shown in the disclaimer — every chain he was credited on closed.

Underlying `closeRate` numeric stays as-is for sorting (or we set it to 100 in that branch so sort behaves intuitively — recommended). No change to Coached, Closes, or Totals row math.

### Coherence proof to produce after build
- Drift card no longer renders on Studio tab.
- Studio Scoreboard shows the new disclaimer; tile numbers unchanged (Intros Run 2, Sales 2, Close Rate 100%).
- Per-Coach table: Nathan row shows Coached 0, Closes 1, Close% 100% (green). Natalya still shows 1/0/0% (red). Koa still 1/1/100%. Totals row unchanged at 2/2/100%.
- All agree across Studio Scoreboard, Per-Coach table, and Coach Stats drilldown.
