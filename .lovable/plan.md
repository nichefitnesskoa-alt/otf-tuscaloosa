# Outreach Lists — reusable campaign lists

## Diagnosis (as requested)

**1. CSV/XLSX import.** The app already uses SheetJS (`xlsx@0.18.5`). The canonical example is `src/components/shared/NetGainScoreboard.tsx` (`XLSX.read`, `XLSX.utils.sheet_to_json`, `<input accept=".csv,.xlsx,.xls">`) and `src/components/admin/MindbodyImportsPanel.tsx`. New feature will reuse this exact pattern — no new parser dep.

**2. SOML logging flow.** `LogDialog` inside `src/features/wig/soml/SomlSection.tsx` writes to `soml_upgrades` (fields: `member_name`, `upgraded_by`, `notes`, `created_by`) and `soml_manual_referrals` (fields: `member_name`, `referred_by`, `notes`, `created_by`), then calls `notifySomlChanged()` so the scoreboard refetches via `useSomlData`. We will extract `LogDialog` into `src/features/soml/LogSomlDialog.tsx` and reuse it — outreach rows open the identical dialog pre-filled with `member_name`. No change to writes, credit rules, or `useSomlData` aggregation.

**3. Realtime pattern.** Standard: `supabase.channel(name).on('postgres_changes', {event:'*', schema:'public', table}, cb).subscribe()` inside a `useEffect`, torn down with `removeChannel`. Examples: `useRealtimeMyDay.ts`, `BingoAdminPage.tsx`, `useMyOwnItMentions.ts`. We'll mirror this for `outreach_list_rows` and `outreach_row_actions`.

## Data model (migration — pending approval)

- `outreach_lists`: `id`, `name`, `campaign_tag`, `active bool default true`, `created_by`, `created_at`.
- `outreach_list_rows`: `id`, `list_id fk`, `client_name`, `email`, `phone`, `item`, `amount numeric`, `worked_out_30d bool`, `last_30d_count int`, `latest_workout_date date`, `is_churning bool`, `churn_date date`, `metadata jsonb` (unmapped columns), `created_at`.
- `outreach_row_actions`: `id`, `row_id fk`, `action_type text` (`texted` | `in_person` | `save_attempt`), `done_by`, `done_at timestamptz default now()`, `notes`.
- RLS: `authenticated` full CRUD (matches app pattern; no auth.uid in this app). GRANTs to `authenticated` + `service_role`.
- Add all three tables to `supabase_realtime` publication; `REPLICA IDENTITY FULL` on rows + actions.

## Build

**A. Import wizard** (`/outreach-lists/new`, admin-only)
- Upload `.csv/.xlsx`. Uses same `XLSX.read` pattern as `NetGainScoreboard`. Multi-sheet files become multiple lists sharing one `campaign_tag`.
- Two-step: (1) name + `campaign_tag`; (2) per-sheet column mapping UI — dropdowns for `client_name`, `email`, `phone`, `item`, `amount`, `worked_out_30d`, `last_30d_count`, `latest_workout_date`, `is_churning`, `churn_date`. Unmapped columns → `metadata` jsonb (not dropped).
- Nothing SOML-specific in the code path.

**B. Outreach Lists page** (`/outreach-lists`, new nav entry — SA + Coach + Admin)
- Landing: cards grouped by `campaign_tag`, each showing "X of Y contacted" (contacted = row has any action).
- List detail page has two clearly separate sections:
  - **Retention / At-risk** (top, red/amber accent card style, warning header "Save calls — not upsells"): `is_churning=true`, sorted by `churn_date` asc. Row action: single **Log Save Attempt** button → inserts `save_attempt` action + optional note.
  - **Standard outreach** (default card style): `is_churning=false`. Row actions: **Texted** and **In Person** pill buttons. Once tapped, pill shows `✓ Texted · Bri · 2:14p`. Hover/tap shows full attribution list if multiple actions exist.
- Per row: **Log Upgrade** and **Log Referral** buttons open the extracted `LogSomlDialog` pre-filled with `client_name`. Result writes to `soml_upgrades` / `soml_manual_referrals` exactly as today; `notifySomlChanged()` fires; WIG scoreboard updates.
- Realtime subscription on `outreach_list_rows` (churn flag edits) and `outreach_row_actions` (live status). All timestamps rendered in CST via existing `dateUtils`.

**C. Reusability**
- No SOML strings in schema or page. `campaign_tag` is user-set free text. Future campaigns import via the same wizard, no code change.

## Scope guard

- `SomlSection.tsx` logic is **not touched** except to export `LogDialog` for reuse (rename to `LogSomlDialog`, unchanged behavior). `useSomlData`, `soml_upgrades`, `soml_manual_referrals`, pace/status helpers, credit rules — all unchanged.
- New nav entry added to `BottomNav.tsx` under existing role-visibility system (new `nav.outreach_lists` perm key).

## Coherence proof I will produce before reporting done

1. `read_query` `outreach_lists` after SOML import → two rows, both `campaign_tag='SOML'`, names `"Premier $139+"` and `"Elite & Basic"`.
2. `read_query` `outreach_list_rows where is_churning=true` for each list → count matches source sheet's churning rows; UI shows them in the retention section sorted by `churn_date` asc.
3. Playwright as user A marks a row "Texted"; second Playwright context as user B on same list sees the pill flip live with attribution `"Texted · A · <time CST>"`.
4. From a standard row tap **Log Upgrade** → `LogSomlDialog` opens with `member_name` pre-filled → submit → `read_query soml_upgrades` shows the new row → `useSomlData` totals reflect +1 upgrade on WIG page.
5. Before/after `read_query` on `soml_config`, `soml_upgrades`, `soml_manual_referrals`, `soml_sa_goals` shows no schema drift and no unexpected mutations from this build.
6. Closing block: "All agree: yes".

## Technical notes

- New files: `supabase migration`, `src/pages/OutreachLists.tsx`, `src/pages/OutreachListDetail.tsx`, `src/pages/OutreachListImport.tsx`, `src/features/outreach/*` (hooks, row components, retention section, standard section, action pill), `src/features/soml/LogSomlDialog.tsx` (extracted).
- Edits: `src/App.tsx` (3 routes), `src/components/BottomNav.tsx` (nav entry), `src/lib/auth/roles.ts` (add `nav.outreach_lists`), `src/features/wig/soml/SomlSection.tsx` (import `LogSomlDialog` from new location instead of local copy).
- Realtime channel names: `outreach-list-<listId>` scoped per detail page; teardown in effect cleanup to avoid the subscription-leak footgun.
