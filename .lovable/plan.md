Two small changes.

### 1. Show full script bodies in Send Script drawer

`src/components/scripts/ScriptSendDrawer.tsx` — line 311 currently slices the preview at 100 chars and adds `...`. That's the only place script bodies get truncated.

Change:
- Drop the `truncated` slice. Render the full resolved body in a `whitespace-pre-wrap` block so paragraph breaks and emoji stay readable.
- Keep the existing card / Copy to Clipboard layout, just let height grow with content. The drawer already sits inside a `ScrollArea`, so longer cards just scroll.

Result: every script in the list shows its complete text at a glance. No "expand" toggle needed because the drawer scrolls.

### 2. Move Upcoming Intros up on My Day

Today the order on `/my-day` is: floating header → reminder banner → Today's Actions → **Shift Checklist (Today's Shift)** → Class Milestone Checks → Ask for a Referral → Activity Tracker → Tabs (Intros / Leads / Follow-Up / Scripts), with `UpcomingIntrosCard` living inside the Intros tab.

Change in `src/features/myDay/MyDayPage.tsx`:
- Add `<UpcomingIntrosCard userName={user?.name || ''} fixedTimeRange="weekFull" />` directly under the Shift Checklist block, above Class Milestone Checks.
- Remove the duplicate mount inside `<TabsContent value="intros">` so it doesn't render twice on the same page (Intros tab keeps `NewLeadsAlert` + `TodayActivityLog`; the upcoming list is now permanently visible above the tabs).
- Intros tab badge count (`todayBookingsCount`) keeps working — it reads from the same data hook, not from the card mount.

### Coherence check before done

- `/my-day` renders Upcoming Intros once, directly under Shift Checklist.
- Intros tab still loads (NewLeadsAlert + TodayActivityLog) and the tab badge still counts today's intros.
- Send Script drawer (opened from Ask for a Referral, Today's Activity, Class Milestone Checks, Coach My Intros, etc.) shows full script bodies, scrolls when long.
- No other consumer of `UpcomingIntrosCard` was relying on it being inside the Intros tab — quick rg confirms it's only mounted in `MyDayPage.tsx`.