
## Diagnosis: "constant refresh" on My Day

The session replay shows DOM nodes being torn down and rebuilt on a tight cadence (status badges flipping, time labels redrawing, milestone rows re-mounting). This is **not** a full `window.location` reload — `ErrorBoundary.handleReload` is the only `reload()` call and is button-only. It's also **not** a runaway useEffect loop (no setState-inside-effect that depends on its own output, no router redirect loop). It is a **cascade of timers + realtime subscriptions + unstable child keys** firing constantly in the My Day tree and re-rendering large chunks of UI.

Here are the specific root causes, ranked by impact.

---

### 1. Ticker storm on My Day (biggest contributor)

Six independent components on `/my-day` each run their own `setInterval`, every one of them calling `setState` on its parent subtree:

| File | Line | Interval |
|---|---|---|
| `src/features/myDay/ClassMilestoneChecks.tsx` | 63 | 30s — `setMinutesNow(...)` re-renders the whole milestone list |
| `src/features/myDay/IntroRowCard.tsx` | 158 | 60s — runs **per row** |
| `src/features/myDay/IntroRowCard.tsx` | 200 | 30s — runs **per row** |
| `src/features/myDay/UpcomingIntrosCard.tsx` | 213 | 60s |
| `src/features/myDay/NewLeadsAlert.tsx` | 149 | 60s — also re-runs `fetchNewLeads()` which queries `intros_booked` with no filter |
| `src/features/myDay/MyDayNewLeadsTab.tsx` | 474 | 5 min — `backgroundDedupRecheck()` |
| `src/components/dashboard/IntroCountdown.tsx` | 33 | 60s |
| `src/components/leads/FollowUpQueue.tsx` | 185, 324 | React Query `refetchInterval: 60_000` and `120_000` |

With N intro cards visible, you have ~`2N + 5` timers firing within any 60-second window, each producing a `setState` that re-renders sibling subtrees. To the user this looks like the page is constantly refreshing.

**Fix direction:**
- Hoist a single 30s "now" ticker into a context (e.g. `useNowMinute()`), have all per-row countdowns subscribe to that value instead of owning their own intervals.
- Drop the per-row 30s interval in `IntroRowCard` — 60s is enough granularity for "minutes until class".
- Remove the 60s `fetchNewLeads` poll in `NewLeadsAlert`; it already has realtime subscriptions on `lead_activities` and `intros_booked`. Polling is redundant.
- For `FollowUpQueue`, drop `refetchInterval` — the realtime subscription on `follow_up_queue` already covers liveness.

### 2. Realtime channel fans out and re-fetches everything

`src/hooks/useRealtimeMyDay.ts` subscribes to **six tables** (`intros_booked`, `intros_run`, `leads`, `follow_up_queue`, `script_actions`, `intro_questionnaires`) and fires `onUpdate` on every `*` event. On `/my-day`:

- `MyDayPage.tsx:178` — every event triggers `setTimeout(fetchMetrics, 1500)`. `fetchMetrics` (line 230) runs three Supabase queries and calls `setTodayScriptsSent`, `setTodayFollowUpsSent`, `setNeedsOutcomeCount` — three re-renders of the whole page.
- The cleanup returned by `handleRealtimeUpdate` is **discarded** because `useRealtimeMyDay`'s subscriber doesn't call it. So each event leaks a 1.5s timer (not a loop, but compounds the cascade).
- In a busy studio (`script_actions` writes happen on every clipboard copy, `intro_questionnaires` writes on every Q field), this fires many times per minute.

`src/features/myDay/NewLeadsAlert.tsx:130` adds **another** realtime channel on `lead_activities` and `intros_booked` — duplicate coverage of `intros_booked` already in `useRealtimeMyDay`.

`src/features/myDay/ClassMilestoneChecks.tsx:73` adds a third channel.

**Fix direction:**
- In `useRealtimeMyDay`, scope subscriptions to the tables that surface needs to know about (split into per-page hooks, e.g. `useRealtimeIntros`, `useRealtimeFollowUps`).
- Debounce the realtime handler in `MyDayPage` (one trailing call per ~2s window) and remove the leaked-timer pattern by moving the `setTimeout` into a ref.
- Have `MyDayPage` pull `todayScriptsSent`, `todayFollowUpsSent`, `needsOutcomeCount` from `useQuery` keyed on `['myday-metrics', user.name, todayStr]` so React Query dedupes & caches.

### 3. Unstable `todayStr` recomputed every render

Several components compute `const todayStr = format(new Date(), 'yyyy-MM-dd')` directly in the render body:

- `src/features/myDay/MyDayPage.tsx:143` (`getTodayYMD()`)
- `src/features/myDay/ShiftChecklist.tsx:63`
- `src/features/myDay/MyDayShiftSummary.tsx:26`
- `src/features/myDay/ClassMilestoneChecks.tsx:49` (`useMemo([today])` — fine, but `today` updates every 30s)

`todayStr` value is stable for the day, so the **deps don't re-fire**, but each render produces a fresh string passed to children — combined with the inline arrow callbacks in `MyDayPage` (e.g. `onSaved={() => { ... refreshData(); fetchMetrics(); }}` at line 528, `onDone={() => { setBookIntroLead(null); fetchMetrics(); }}` at 541), every memoized child gets a new prop identity each render and re-renders too.

**Fix direction:**
- Memoize `todayStr`/`greeting` with `useMemo(..., [])` (or compute once in a top-level provider).
- Wrap callback props in `useCallback`.

### 4. `useDataAudit` singleton triggers cross-component re-renders

`src/hooks/useDataAudit.ts` keeps a module-level `listeners` set. When the 30-minute interval runs `runFullAudit`, it calls `notifyListeners()` which `setResult` on every subscribed component. `runAudit` is `useCallback(..., [running])` so its identity flips on every audit (running → true → false). Not strictly a loop, but any consumer that depends on `runAudit` in its own effect will re-run.

Lower priority — verify no consumer puts `runAudit` in a `useEffect` dep array.

### 5. Things that look suspicious but are NOT the cause

- `QueryClient` defaults in `src/App.tsx` already disable `refetchOnWindowFocus`. Good.
- `AuthContext` only resolves the user once from `localStorage`. No re-init loop.
- `DataContext.fetchData` runs once on mount. The `online`/`myday:walk-in-added` listeners only refire on real events.
- `ErrorBoundary` only reloads on explicit user click.
- Router has no auto-redirect loops; `ProtectedRoute` redirects to `/my-day` once when conditions match.

---

### Suggested order of work (when the user approves)

1. Hoist a single `useNowMinute()` ticker (and Chicago "today" rollover) into a tiny provider; consume in `IntroRowCard`, `UpcomingIntrosCard`, `ClassMilestoneChecks`, `IntroCountdown`, `NewLeadsAlert`. Net effect: 1 `setState` per minute studio-wide, not ~`2N+5`.
2. In `MyDayPage`, debounce `handleRealtimeUpdate` to a single trailing call per 2.5s using a `useRef` timer, and convert the three `fetchMetrics` counters into a `useQuery` so they share cache and don't each trigger a separate render.
3. Remove redundant polling: `NewLeadsAlert` 60s interval, `FollowUpQueue` `refetchInterval`s, second 30s timer in `IntroRowCard`.
4. Memoize/`useCallback` the inline handlers in `MyDayPage` that fan out to drawers and lists, so memoized children stop re-rendering on every parent tick.
5. Split `useRealtimeMyDay` so My Day only subscribes to the tables it actually consumes (drop `script_actions` + `intro_questionnaires` from MyDay's subscription; consume those locally where needed).

No code changes yet — this plan documents the cause and the fix shape for your approval.
