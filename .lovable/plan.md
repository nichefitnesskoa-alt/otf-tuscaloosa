# Summer of More Life — Diagnose Report + Build Plan

## DIAGNOSE (as requested, before building)

### 1. Canonical pace + leaderboard patterns to reuse

- **Pace helper**: `paceToToday(monthlyTarget, on)` in `src/lib/wig/pace.ts`. Also exports `statusColor` (R/Y/G), `statusClasses`, `formatPace`. This is what Leads hero + `WigSaLeaderboard` already use.
- **Hero tile pattern**: `src/pages/Wig.tsx` renders the Leads hero with `paceToToday(monthlyGoal)` + `statusColor(actual, pace)` + "X today" subline.
- **Flat monthly ÷ active SA count**: `monthlyGoal / useActiveStaff().salesAssociates.length` — the per-SA target used in `WigSaLeaderboard`.
- **Editable goal**: pencil icon on the hero tile writes to `studio_settings` (key/value). Same pattern will store SOML goals.

### 2. Lead source for referrals

- Canonical values in `src/types/index.ts`: `"Member Referral"` and `"Member Referral (5 class pack)"`.
- Referring-member field **already exists**: `intros_booked.referred_by_member_name` (nullable text). Used in `useDashboardMetrics`, `useLeadMeasures`, `Wig.tsx`, and `applyIntroOutcomeUpdate.ts` (auto-detects referral purchase).
- Captured in `IntroBookingEntry` / `EditBookingDialog` — currently **not required** when lead_source is Member Referral. This is the app-wide data-integrity fix.

### 3. Sale detection reuse

- `isSaleCanon(result_canon)` + `getRunSaleDate(run)` from `src/lib/sales-detection.ts` — already date-range filterable via `isSaleInRange`. SOML Sales tile = same helper, window = `soml_config.start_date..end_date`. No new sale logic.

### 4. Booker vs closer (referral credit)

- `intros_booked.booked_by` = SA who created the booking → **this is who gets referral credit** per Alex's intent.
- `intros_booked.intro_owner` = commission owner (may differ, e.g. self-booked or reassigned).
- `intros_run.sa_name` = closer.
- Referral credit → **booked_by** (falls back to intro_owner only if booked_by is null/"Self booked").

### 5. WIG page layout

- `src/pages/Wig.tsx` composes stacked sections. The Leads scoreboard is one block (hero card + `WigSaLeaderboard`). SOML mounts as a **sibling block** below Leads, its own `<section>` with a distinct header ("Summer of More Life"), same card/tile styling but visually separated (divider + section title). Zero edits to the Leads block.

---

## BUILD PLAN

### Part 1 — Require `referred_by_member_name` when lead_source = Member Referral (app-wide)

- **Client**: `IntroBookingEntry.tsx` + `EditBookingDialog.tsx` — when lead_source is either Member Referral value, mark field required, block Save with inline error.
- **Server**: DB trigger `enforce_member_referral_has_referrer` on `intros_booked` (BEFORE INSERT/UPDATE) — raise if lead_source in the two values and `referred_by_member_name` is null/blank.
- **Historical gap report**: run `SELECT count(*) FROM intros_booked WHERE lead_source IN ('Member Referral','Member Referral (5 class pack)') AND (referred_by_member_name IS NULL OR btrim(referred_by_member_name)='') AND deleted_at IS NULL` and report count. No backfill.

### Part 2 — Data model (new tables only)

Migration adds:

`**soml_config**` (singleton row, id=1):

- `start_date date`, `end_date date` (CST window)
- `referrals_goal int`, `upgrades_goal int`, `sales_goal int` (monthly EOM)
- `updated_at`, `updated_by`
- GRANTs: `authenticated` read/write, `service_role` all. RLS: authenticated staff read+update.

`**soml_upgrades**` (manual log):

- `member_name text not null`, `upgraded_by text not null` (SA login name), `upgraded_at timestamptz default now()`, `notes text`, `created_by text`
- GRANTs + RLS: authenticated insert/select; admin update/delete.

`**soml_manual_referrals**` (backup manual entries — additive):

- Same shape: `member_name`, `referred_by text` (SA), `referred_at timestamptz`, `notes`, `created_by`
- Dedup rule in hook: exclude a manual row if an automatic qualifying row exists for the same member_name (case-insensitive) within window.

**No new referral or sales table** — automatic paths use existing data.

### Part 3 — SOML section on WIG page

New files:

- `src/hooks/useSomlData.ts` — reads `soml_config`, computes:
  - **Automatic referrals**: `intros_booked` where `lead_source ILIKE 'Member Referral%'` joined to `intros_run` where `isSaleCanon(result_canon)` and `getRunSaleDate` within SOML window → credit `booked_by`.
  - **Manual referrals**: `soml_manual_referrals` in window, dedup by member_name against automatic.
  - **Upgrades**: `soml_upgrades` in window, grouped by `upgraded_by`.
  - **Sales**: same as WIG sales (`useSaSales` pattern) filtered to SOML window.
- `src/features/wig/soml/SomlSection.tsx` — main section: header "Summer of More Life", 3 hero tiles, 2 log buttons, SA leaderboard.
- `src/features/wig/soml/SomlHeroTile.tsx` — reuses `paceToToday`/`statusColor`/`statusClasses`; edit pencil for admin opens dialog to update the specific goal in `soml_config`.
- `src/features/wig/soml/SomlLeaderboard.tsx` — table: SA | Referrals | Upgrades | Sales — each cell shows count + mini pace bar vs per-SA target (`goal / activeSaCount`).
- `src/features/wig/soml/LogUpgradeDialog.tsx` + `LogManualReferralDialog.tsx` — member_name + notes, attributed to logged-in SA, invalidates SOML queries.
- `src/features/wig/soml/SomlConfigDialog.tsx` — admin edit window dates.

Mount inside `src/pages/Wig.tsx` as a separate `<section>` after the Leads block. Zero changes to Leads composition.

### Scope guards enforced

- Leads scoreboard code, queries, targets untouched.
- No new date/sale/attribution logic — only reuses existing helpers.
- Only app-wide data change = required `referred_by_member_name` when lead_source is Member Referral.

### Verification (before "done")

- SQL: `SELECT * FROM soml_config`; count automatic vs manual referrals; sales in window; upgrades in window.
- UI: WIG page shows Leads block unchanged + SOML block below.
- Create Member Referral booking without referrer → save blocked (client + server).
- Mark as sale in window → SOML Referrals +1 credited to booker, SOML Sales +1.
- Log upgrade → tile + leaderboard row updates.
- Log manual referral for same member as an automatic one → suppressed.
- Edit SOML goal → hero, per-SA target, pace all recompute.

---

## Questions before I execute

1. **SOML window default**: I'll seed `start_date = today`, `end_date = 2026-08-31`. Confirm or give exact dates.
2. **Default monthly goals**: I'll seed all three to `0` and let Koa set them via the pencil. OK?
3. **Log Upgrade / Manual Referral buttons**: visible to SAs + Admin (same as "Add Lead"), yes?

Reply "go" with any answer overrides and I'll build the whole thing in one pass ending with the COHERENCE PROOF block.

&nbsp;

1. SOML window is all of July
2. Ok
3. Yes

&nbsp;