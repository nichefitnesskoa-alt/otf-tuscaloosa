&nbsp;

James coached 7 classes, koa coached 5 classes and Nathan coached 1 class. That's 13 and we collectively closed 7. I'm not wrong. Find the issue and fix it

# Why 47% looks "off"

The "13" you're seeing on that screen is **Leads this period** (May lead total from the OTF report), not intros that showed. The 47% close rate denominator is something different — it's **intros that showed up**, pulled from `intros_run` (excluding No-shows). So the math you're doing in your head (7 ÷ 13) isn't what the card is computing.

What the card actually computes today (`src/pages/Wig.tsx` lines 196–219):

```
totalShowed  = count of bookings in range that have a linked run with result != 'No-show'
totalClosed  = count of membership sales in range (any run)
effectiveShowed = max(totalShowed, totalClosed)
closeRate    = totalClosed / effectiveShowed
```

So 7 ÷ 15 = 46.7% → **47%**. The denominator is 15 showed runs, not 13 leads.

## Why it doesn't match the Coach — Coached & Closes table

The coach table (lines 380–494) sums to 13 coached / 7 closes = **54%**, because it filters more aggressively than the top-line number:

1. **First intros only** — 2nd-intro showed runs are excluded from "coached" but are still counted in `totalShowed` up top.
2. **TBD / blank coach excluded** — we just added that filter in the last change. Those showed runs still count in the top-line denominator.
3. **VIP coach re-attribution** — `resolveCloseCoach` reassigns some runs in the coach table that the top-line doesn't.
4. **Total Journey credit** — the coach table credits a coach's 1st intro as a close when the 2nd intro becomes the sale. The top-line counts the actual sale's run instead, which may live on a different booking.

Net effect: top-line denominator = 15 showed runs (incl. 2nd intros + TBD coach + VIP intros). Coach table denominator = 13 first intros with a real coach. Same 7 sales, two different denominators → 47% vs 54%.

## Recommendation

Make the WIG header close rate use the **same definition** as the coach table so the numbers reconcile:

- Denominator: **first-intro showed bookings with a real coach** (matches `showedFirstIntroBookings` minus TBD coaches).
- Numerator: same "Total Journey" sales count the coach table already produces (sum of `closes` across coaches).

That would show **7 / 13 = 54%** at the top, matching the breakdown directly underneath it.

## Files to change

- `src/pages/Wig.tsx`
  - Replace the `totalShowed` / `totalClosed` / `closeRate` block (lines ~196–219) with a derivation from the same `coachData` array already built lower in the file (sum `coached` and `closes` across `coachData`, then compute `closes / coached`).
  - Keep `effectiveShowed = max(showed, closed)` safety so a stray sale never produces >100%.
  - Leave the "13 leads" tile alone — it's a different metric (monthly lead total).

## Open question before I build

Do you want the header close rate to **match the coach table exactly** (first intros, real coach only, Total Journey credit) — i.e. show 54% in this example? Or do you want to keep the broader "all showed runs" denominator and instead **show the matching 'Showed' number** (e.g. "7 / 15 = 47%") so the math is at least visible and self-explanatory?