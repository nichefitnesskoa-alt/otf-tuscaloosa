# Net Gain automation + admin-only goal editing

## 1. Admin-only editing (Koa only)

Every "set a goal / change the number" control gets gated behind `useEffectiveAdmin()` (which already respects the Admin ↔ Staff view toggle on WIG). Non-admins see numbers, never inputs.

**Net Gain scoreboard**
- +1 / −1 / edit exact value / upload churns / manage churns → all admin-only
- History dialog stays visible to everyone (read-only audit)

**SOML section (WIG)**
- Goal pencils, window edit, Log Upgrade, Log Referral → already admin, keep it that way and verify the pencil actually persists (uses the `useEffectiveAdmin` hook already)
- **New**: per-SA override pencil next to each cell in the SA leaderboard (Referrals / Upgrades / Sales). Admin-only. Null override = use flat "goal ÷ SA count" default.

**WIG SA leaderboard**
- Team lead goal + per-SA lead-goal overrides → already admin-gated in code; audit and confirm nothing leaks to non-admins.

**WIG studio leads target + coach close target**
- Already admin-gated. Verified.

## 2. Net Gain visual redesign

Full-width card at the top of My Day, Studio, WIG. One giant number — the whole card mood shifts with the value:
- Positive → deep green background, white number, up arrow
- Negative → deep red background, white number, down arrow
- Zero → neutral bone card

The number renders at ~text-6xl bold tabular. Sits above a small secondary line: "Need +N more net sales to be positive by MMM DD" (see §3). Admin controls collapse into a compact toolbar on the right.

## 3. Auto Net Gain automation

**New tables**
- `net_gain_churns` — planned churn list. Fields: `member_name`, `churn_date`, `notes`, `applied_at`, `upload_batch_id`, `created_by`. Applied when `churn_date` has passed CST midnight; each applied churn writes a −1 entry to `net_gain_log` tagged with the churn id (idempotent).
- Extend `net_gain_log` with `source_type` (`manual` / `sale` / `churn`) and `source_id`. Unique partial index on (`source_type`, `source_id`) for non-manual rows so nothing double-counts.

**Auto-add on every sale**
- Postgres trigger on `intros_run` INSERT/UPDATE. When the row becomes a sale (`result_canon` in the canonical SALE set), insert a +1 log row with `source_type='sale'`, `source_id=intros_run.id` and bump `net_gain_state`. Reversal handled if a sale row is later flipped to non-sale.
- Same trigger pattern for `sales_outside_intro` inserts (outside-intro membership sales).

**Auto-subtract the day after a churn**
- A SQL function `apply_pending_net_gain_churns()` walks `net_gain_churns` where `churn_date < today CST` and `applied_at IS NULL`, writes a −1 log row per churn tagged with the churn id, bumps `net_gain_state`, and stamps `applied_at`. The Net Gain scoreboard calls this RPC on mount so any user opening the page picks up yesterday's churns — no cron required.

**Spreadsheet upload (admin-only)**
- New "Upload Churns" button on the Net Gain card. Accepts `.csv`, `.xlsx`, `.xls`. Parses columns `Name` and `Churn Date` (accepts common date formats — normalized to `YYYY-MM-DD` in CST). Preview grid shows the parsed rows and flags any obvious dupes against existing churns. Confirm → bulk insert with a shared `upload_batch_id`.
- Adds `xlsx` (SheetJS) as a dependency for parsing.

**"Manage Churns" dialog (admin-only)**
- Table of all this-month + next-month churns. Columns: Name, Churn Date, Status (Pending / Applied MMM D), row actions: edit, delete. Deleting an already-applied churn reverses its −1.

**End-of-month goal line**
- Under the giant number: "Need +N more net sales by MMM DD to be positive."
- Formula: `N = max(0, pending_churns_in_month − current_net_gain)`. Recomputes live as churns get applied and sales roll in.

## 4. Cross-page coherence
All three mount points (My Day, Studio, WIG) render the same `NetGainScoreboard` and subscribe to the same `otf:netGainChanged` event, so upload/edit/auto-apply on one tab updates the others without refresh. Trigger-driven sales and churn RPC also fire the same invalidation via Realtime on `net_gain_state`.

## Technical section

### Migrations
- `ALTER TABLE public.net_gain_log ADD COLUMN source_type text NOT NULL DEFAULT 'manual', ADD COLUMN source_id text;`
- `CREATE UNIQUE INDEX net_gain_log_source_unique ON public.net_gain_log(source_type, source_id) WHERE source_type <> 'manual';`
- `CREATE TABLE public.net_gain_churns (id uuid pk, member_name text, churn_date date, notes text, applied_at timestamptz, upload_batch_id uuid, created_by text, created_at timestamptz);` + public RLS matching other app tables.
- `CREATE TABLE public.soml_sa_goals (id uuid pk, sa_name text unique, referrals_goal int, upgrades_goal int, sales_goal int, updated_by, updated_at);` + public RLS.
- Function `public.apply_pending_net_gain_churns()` — loops eligible churns, inserts log rows (idempotent via source_id), updates `net_gain_state`, returns `{applied: n}`.
- Function `public.net_gain_apply_sale_delta()` — insert/update/delete trigger body for `intros_run` and `sales_outside_intro`; uses `source_type='sale'` + `source_id=row.id`.
- Triggers wiring those functions.

### Frontend files
- `src/components/shared/NetGainScoreboard.tsx` — redesign, admin-gated controls, call `apply_pending_net_gain_churns` RPC on mount, show end-of-month goal line.
- `src/components/shared/ChurnUploadDialog.tsx` — file picker, xlsx/csv parse, preview, confirm.
- `src/components/shared/ChurnManageDialog.tsx` — list, edit, delete churns.
- `src/hooks/useNetGainSummary.ts` — pulls state + pending-churn count + month goal calc, subscribes to event bus.
- `src/features/wig/soml/SomlSection.tsx` — per-SA override pencils; overrides table read from `soml_sa_goals`.
- `bun add xlsx`

### Files audited for admin-gating
- `NetGainScoreboard.tsx`, `SomlSection.tsx`, `Wig.tsx` (studio/close/leads targets, per-SA lead overrides), `WigSaLeaderboard.tsx`.

### Coherence proof I'll produce at the end
- `net_gain_state.value` matches sum of all `net_gain_log.delta`.
- One synthetic churn dated yesterday, one intros_run flipped to a sale canon, one manual +1 — verify all three land in `net_gain_log` with correct `source_type`, `net_gain_state.value` moves accordingly, and My Day + Studio + WIG all show the same number.
