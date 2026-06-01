
## Changes

### 1. `src/features/myDay/MyDayPage.tsx` — remove dead sections, reorder

- **Remove** the `<TodaysActions />` block (lines ~351–354, "All clear across the team." card).
- **Remove** `<TodayActivityLog ... />` from the Intros tab content (line 407) — the "Today's Activity" expandable.
- **Remove** the standalone bottom `<UpcomingIntrosCard userName=… fixedTimeRange="weekFull" />` block (lines ~428–431).
- **Move** `<UpcomingIntrosCard userName={user?.name||''} fixedTimeRange="weekFull" />` into the Intros `<TabsContent value="intros">` **above** `<NewLeadsAlert />`. Final order inside the Intros tab:
  1. `UpcomingIntrosCard`
  2. `NewLeadsAlert`
- Drop the now-unused imports (`TodaysActions`, `TodayActivityLog`).

The `TodaysActions` and `TodayActivityLog` component files stay in the repo (still referenced elsewhere or harmless dead code — out of scope to delete). Only the MyDay mounts are removed.

### 2. `src/features/myDay/UpcomingIntrosCard.tsx` — add tomorrow confirmation banner

Add a prominent inline banner directly under the card header (above the week-nav row), shown only when:
- the current view is the current week (`isCurrentWeek`), and
- tomorrow has 1+ intros, and
- one or more of tomorrow's intros has no `confirmedAt`.

Computation (uses existing `items` from `useUpcomingIntrosData`, which already carries `confirmedAt` from `script_actions.action_type='confirmation_sent'`):

```ts
const tomorrowStr = format(new Date(Date.now() + 86_400_000), 'yyyy-MM-dd');
const tomorrowItems = items.filter(i => i.classDate === tomorrowStr);
const tomorrowUnconfirmed = tomorrowItems.filter(i => !i.confirmedAt).length;
```

Banner UI (loud, OTF orange, full width, 44px+ tap area):

```
⚠️  Text & confirm tomorrow's intros
    X of Y not confirmed yet — send confirmation now
                                        [ Go to tomorrow → ]
```

- Container: `border-2 border-primary bg-primary/15 rounded-md px-4 py-3 flex items-center justify-between gap-3`
- Icon: `AlertCircle` (already imported)
- Title `text-sm font-bold text-primary`, sub `text-xs text-foreground/80`
- Right action: `Button size="sm"` labeled `Go to tomorrow →`. On click: `setSelectedDate(tomorrowStr)` so the day-pill jumps to Tomorrow and the existing per-intro confirm flow / `Send 1 Q` buttons appear.
- Hide entirely when `tomorrowUnconfirmed === 0`.

No business-logic changes — purely UI surface over the existing `confirmedAt` field. No DB, no hooks, no metric changes.

## Coherence check (will run after build)

- `Today's Actions` and `Today's Activity` no longer render on MyDay; nothing else mounts them in MyDay.
- Intros tab order: Upcoming Intros → New Leads Alert.
- Banner count matches: `tomorrow intros where confirmedAt is null` from the same `items` array that drives the day groups, so banner count = sum of unconfirmed shown on the Tomorrow tab.
