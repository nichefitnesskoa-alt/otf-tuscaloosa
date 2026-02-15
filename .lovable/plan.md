

## Fix: Keep Completed Intro Cards Visible in Today's Intros

### Problem
Currently, logged intros are removed from "Today's Intros" and placed in a separate "Completed Today" collapsible section. The user wants all intro cards to stay in one unified section, with logged ones visually marked but never hidden.

### Changes (single file: `src/pages/MyDay.tsx`)

**1. Merge all cards into Today's Intros**
- Replace the current split logic that renders only `pendingIntros` in Today's Intros
- Render ALL `todayBookings` in the Today's Intros section, sorted: unlogged first, then logged
- Remove the separate `completed-today` case from the section renderer

**2. Update section header**
- Change count display to: "Today's Intros (5) - 3 logged, 2 remaining"
- Add mini outcome summary badges next to header (colored dots: "2 purchased, 1 didn't buy")

**3. Visual treatment for logged cards**
- Add a left border color on logged cards: green for purchased, amber for didn't buy, red for no-show
- Show outcome badge inline on the card header row
- Show "Logged by [name] at [time]" in small muted text
- Show objection for didn't-buy, membership type for purchased
- Keep all action buttons functional (Prep, Script, Copy #)

**4. Follow-up confirmation notes on logged cards**
- For no-show/didn't-buy: show "Follow-up Touch 1 queued for today" confirmation
- For failed follow-up creation: show "Tap to retry" warning (existing logic, moved inline)

**5. Post-purchase actions on logged cards**
- Show PostPurchaseActions component (Welcome Text, Referral Ask) for purchased outcomes

**6. "All intros logged" message**
- When all are logged, show a small "All intros logged! Great work." note below the last card instead of replacing the cards

**7. Keep the `completed-today` section case but skip rendering it**
- Remove it from `sectionOrder` rendering so it no longer appears as a separate section
- All the completed card rendering logic moves into the `todays-intros` case

### Technical Details

The `todays-intros` section case (lines ~943-976) will be rewritten to:

```text
// Sort: unlogged first, then logged
const sortedTodayBookings = [...todayBookings].sort((a, b) => {
  if (!a.intro_result && b.intro_result) return -1;
  if (a.intro_result && !b.intro_result) return 1;
  return 0; // preserve original time order within each group
});
```

Each card gets conditional styling:
```text
// Left border tint for logged cards
const borderClass = isPurchased ? 'border-l-4 border-l-emerald-500'
  : isDidntBuy ? 'border-l-4 border-l-amber-500'
  : isNoShow ? 'border-l-4 border-l-red-500' : '';
```

The `renderCompactIntroCard` function already handles both logged and unlogged states (it shows PostPurchaseActions, action bars, etc.), so the main change is ensuring logged cards render there with the added visual treatment (outcome badge, logged-by text, border tint, follow-up confirmation).

### Files to modify
| File | Change |
|---|---|
| `src/pages/MyDay.tsx` | Merge completed cards into Today's Intros section, add outcome visuals, remove separate Completed Today section |

No database changes. No new files. No changes to other components.

