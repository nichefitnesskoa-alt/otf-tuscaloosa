*Update the plan with these two changes before building:*

*1. ROW LIMIT — remove all hard limits* *Instead of adding* `.limit(5000)` *everywhere, remove all row limits entirely from every query in DataContext.tsx, useLeadMeasures.ts, and MyDayTopPanel.tsx. Do not replace one arbitrary cap with another. Supabase has no enforced row limit on the server side — the 1000-row default only applies when no limit is specified via the JS client. Use* `.limit(null)` *or remove the limit call entirely to fetch all rows.*

*2. DATE RANGE — make it configurable not hardcoded* *Remove the hardcoded 120-day cutoff from all queries. Replace with a config constant at the top of DataContext.tsx:*

```typescript
const DATA_LOOKBACK_DAYS = null; // null = no limit, or set to number of days

```

*When null — fetch all historical data with no date filter.* *When set to a number — apply the date filter as today minus that many days.* *Default to null so all data is always available.*

*Apply both changes to every query in: DataContext.tsx, useLeadMeasures.ts, MyDayTopPanel.tsx, and any other file the plan touches.*

*Everything else in the plan stays the same. Approve and build.*  
  
Plan: Fix Scoreboard Sales, Lead Measures Accuracy, and Auto-Close Shift Recaps

### Root Causes Identified

**1. Supabase 1000-row limit silently truncating data**

`DataContext.fetchData()` fetches all tables with `select('*')` but no explicit limit override. Supabase defaults to 1000 rows. With 120 days of data, `intros_booked` and `intros_run` likely exceed 1000 rows, so the data the scoreboard and lead measures compute from is incomplete.

Similarly, `useLeadMeasures` makes 6 parallel queries with no `.limit()` — all subject to the same 1000-row cap.

`MyDayTopPanel.useQAndPrepRates` also caps at 500 IDs in the `.in()` clause (`ids.slice(0, 500)`).

**2. Scoreboard sales ≠ Conversion Funnel sales**

The Scoreboard aggregates sales from `perSAData` in `useDashboardMetrics`, which only counts sales attributed to a named `intro_owner` not in `EXCLUDED_SA_NAMES`. If a sale has no `intro_owner` or has one like "TBD"/"Unknown", it's dropped from the scoreboard but still counted by the Conversion Funnel (which iterates all `introsRun` regardless of owner).

**3. Lead Measures Prep% undercounting**

`useLeadMeasures` attributes prep to `[b.intro_owner, b.booked_by].find(n => ALL_STAFF.includes(n))`. If `intro_owner` is null/empty and `booked_by` is "Self booked", the booking is skipped entirely — even though Grace prepped it. The SA who prepped should get credit, but `prepped_by` is not being used in the attribution logic.

---

### Changes

**1. Fix 1000-row limit in DataContext** (`src/context/DataContext.tsx`)

- Add `.limit(5000)` to all 6 queries in `fetchData()` to ensure complete data retrieval within the 120-day window.
- Same fix for `refreshFollowUps()` and `refreshTouches()`.

**2. Fix 1000-row limit in useLeadMeasures** (`src/hooks/useLeadMeasures.ts`)

- Add `.limit(5000)` to all 6 parallel queries.

**3. Fix MyDayTopPanel Q/Prep query cap** (`src/features/myDay/MyDayTopPanel.tsx`)

- Remove the `ids.slice(0, 500)` cap; batch into chunks of 500 for the `.in()` call and merge results.

**4. Fix Scoreboard sales: count unattributed sales** (`src/hooks/useDashboardMetrics.ts`)

- After computing `perSAData`, separately count sales from runs with no valid `intro_owner` (null, empty, or in `EXCLUDED_SA_NAMES`). Add these "unattributed" sales to `studioIntroSales` so the scoreboard total matches the funnel.

**5. Fix Lead Measures Prep% attribution** (`src/hooks/useLeadMeasures.ts`)

- Extend the SA resolution to also check `prepped_by` field: `[b.intro_owner, b.prepped_by, b.booked_by].find(...)`. This ensures Grace gets credit when she's the one who prepped.
- Also fetch `prepped_by` in the select clause.

**6. Create auto-close shift recap edge function** (`supabase/functions/auto-close-shifts/index.ts`)

- New edge function that:
  1. Queries today's `shift_recaps` where `submitted_at IS NULL`
  2. Sets `submitted_at = now()` for each unsubmitted recap
  3. For staff with no recap record at all but who have activity today (bookings created, intros run, script actions), creates a recap from auto-captured data and marks it submitted
  4. Posts each auto-closed recap summary to GroupMe
- Register in `supabase/config.toml` with `verify_jwt = false`

**7. Schedule the edge function via pg_cron** (SQL insert, not migration)

- Enable `pg_cron` and `pg_net` extensions
- Schedule `auto-close-shifts` to run daily at 7:00 PM Central (midnight UTC, adjusted for CST)