# WIG legibility + global dark/light toggle

Three coordinated UI changes. No data, no business logic, no hooks touched.

## 1. WIG Team hero — denominator = pace-to-today, big number stays readable

File: `src/components/wig/WigSaLeaderboard.tsx`

- Change hero denominator from month-end total (`teamTargets.sgl`, currently 90) to today's expected total (`Math.round(teamPace.sgl)`, e.g. 48). Label becomes: `of 48 today` (where 48 = `Math.round(teamPace.sgl)`).
- Keep the month-end total findable on the same card by appending: `month goal: {teamTargets.sgl}` in the right-side meta row (next to "Per-SA target × N active SAs"). Nothing about goal-setting is removed.
- Big team number (`text-5xl`): bump to `text-7xl` and switch color from `heroCls.text` (which turns red when behind) to `text-foreground`. In dark mode `--foreground` = white; in light mode it's near-black. The status color stays expressed via the pace bar + the pace-today line, not by recoloring the headline number.
- "Pace today: 48 · behind today — close the gap" line: bump from `text-[11px] text-muted-foreground` to `text-base text-foreground`. The colored status word (e.g. `formatPace(teamPace.sgl)`) keeps `heroCls.text` so red/yellow/green still reads — only the surrounding copy gets larger and brighter.
- Per-SA row big number in the leaderboard table (`text-3xl` colored by status): bump to `text-4xl` and color `text-foreground`. The `/ {pace}` suffix beside it grows from `text-xs` → `text-sm text-foreground`. Status color is preserved on the row's pace bar.
- Leaderboard column subhead `need X today` (already `text-sm text-foreground`) stays; `of X this month` bumps from `text-xs text-muted-foreground` to `text-sm text-foreground`.

## 2. Studio Leads hero — same treatment

File: `src/pages/Wig.tsx` (~lines 825–850)

- Change `of {targets.studioLeads} target` → `of {Math.round(studioLeadsPace)} today`. Append `month goal: {targets.studioLeads}` in the existing target-editor row below so the 182 number is still visible/editable.
- Big number (`text-6xl`): keep size, switch color from `studioHeroCls.text` to `text-foreground` (white in dark, foreground in light).
- "Should be at X by today" block: `text-base` → `text-lg`. Inner "behind pace / ahead" line: `text-sm` → `text-base font-bold`. Round the diff: `Math.round(studioLeadsPace - totalLeads)`.

## 3. Dark / light mode toggle on every page

Today the toggle only lives in `MyDayPage.tsx` (top-right of the floating header). The hook `useDarkMode` is already global and persists via `localStorage`.

- Add a Sun/Moon `Button` to the global `Header` (`src/components/Header.tsx`), placed between `NotificationsBell` and the user `User` icon. Same styling as the My Day toggle (`variant="ghost"`, `size="icon"`, `text-background hover:bg-background/10`).
- Coaches don't render `Header` (see `AppLayout`). Add the same toggle to `BottomNav` (`src/components/BottomNav.tsx`) so coaches always have access; render it as a small icon button to the right of the nav items (or absolutely positioned top-right of the nav bar) — visible for all roles, harmless duplication for non-coaches.
- Remove the toggle from `MyDayPage.tsx` so we don't have two side-by-side once Header has it. (Header is rendered on MyDay for SAs.)

## Out of scope

- No hook changes, no React Query keys, no DB reads/writes, no pace formula changes, no role permissions.
- Targets math, leaderboard sort, drilldowns, GroupMe — untouched.

## Coherence proof (will be produced after build)

- Hero shows `27 of {Math.round(teamPace.sgl)} today` and the Team row in the leaderboard sums to 27 (same source: `totals.sgl`).
- `Math.round(teamPace.sgl)` shown in hero === `formatPace(teamPace.sgl)` rounded === number shown in "Pace today" line.
- Studio hero `of N today` === `Math.round(studioLeadsPace)` === "Should be at N by today".
- Dark toggle visible & functional on /wig, /the-table, /pipeline, /coach-view, /my-day, /vips, /recaps for all three roles.
- Big team SGL number and big per-SA SGL numbers render in white in dark mode (verified via `getComputedStyle` or screenshot) and stay foreground in light mode.

Files to edit: `src/components/wig/WigSaLeaderboard.tsx`, `src/pages/Wig.tsx`, `src/components/Header.tsx`, `src/components/BottomNav.tsx`, `src/features/myDay/MyDayPage.tsx`.
