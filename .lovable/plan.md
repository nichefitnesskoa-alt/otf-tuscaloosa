# VIPs as a Room, MyDay as Today's Actions, Pipeline as Diagnostic

## Investigation findings

### 1. `is_vip` flag — current state
- **No `is_vip` on `leads`.** No central member/profile table.
- `intros_booked.is_vip` exists (boolean), plus `booking_type_canon='VIP'`, `vip_session_id`, `vip_class_name`.
- VIP people today live ONLY in `vip_registrations` (one row per session signup). Already has `birthday`, `weight_lbs`, `phone`, `email`, `outcome*`.
- `VipPipelineTable` displays `is_vip:true` purely as a UI flag, not a stored field.

→ Per your answer: create a new **`vip_members`** table as the central VIP profile, migrate from `vip_registrations` (dedup by normalized phone, fallback to lower(name)).

### 2. Pipeline tab inventory & disposition

| Component | What it does | Disposition |
|---|---|---|
| `PipelineFiltersBar` (tabs: all, upcoming, today, completed, no_show, missed_guest, second_intro, not_interested, by_lead_source, vip_class, vip_scheduler, leads) | Tabs + search + lead-source filter | **Keep in Admin Pipeline** (diagnostic). Strip `vip_class`, `vip_scheduler` tabs. |
| `PipelineSpreadsheet` + `PipelineRowCard` + `PipelineTable` | Spreadsheet of all journeys | **Keep in Admin Pipeline** |
| `PipelineDialogs` (auto_fix, create_booking, edit_booking, delete, etc.) | Diagnostic edits | **Keep in Admin Pipeline** |
| `PipelineNewLeadsTab` | Leads queue | **Move to Follow-Up** (already has Leads tab in MyDay; keep duplicate out — wire to existing `MyDayNewLeadsTab`). |
| `VipPipelineTable` | Per-session VIP roster grid | **Move to VIP tab → "Schedule" sub-tab → session detail** |
| `VipSchedulerTab` | Slot template + 8-week generator + public links | **Move to VIP tab → "Schedule"** |
| `PipelineScriptPicker` | Script send | **Stays available from VIP profile + Admin Pipeline** |
| Routes/redirects | `/leads → /pipeline` | **Update**: SA hits `/pipeline` → redirect to `/vips`. Admin keeps `/pipeline`. |

No components qualify as "Dead". All are reused.

### 3. MyDay current structure (top → bottom)
1. Floating header (greeting, dark toggle)
2. Persistent reminder banner (Mindbody + here)
3. `OfflineBanner`, `VipClaimBanner`
4. `ShiftChecklist`
5. `MyDayShiftSummary` (activity tracker)
6. Sticky tabs: Intros / Scripts / Follow-Up / Leads(admin)
7. Tab content: `NewLeadsAlert`, `TodayActivityLog`, `UpcomingIntrosCard`, `MyDayScriptsTab`, `FollowUpList`, `MyDayNewLeadsTab`
8. Floating End Shift bar, `QuickAddFAB`
9. Drawers: Prep, ScriptPicker, Outcome, BookIntro, LeadDetail

Role behavior today: Coach is *blocked from MyDay entirely* (`blockCoach` on route → redirected to `/coach-view`). Admin sees 4 tabs, SA sees 3.

### 4. VIP scheduler & public availability
- `src/features/pipeline/components/VipSchedulerTab.tsx` — admin scheduler (templates, generation, sessions list).
- `src/pages/VipAvailability.tsx` — public availability page (no auth).
- `src/pages/VipMemberRegister.tsx` (`/vip/:slug/register`) — public claim form.
- `src/pages/VipRoster.tsx` (`/vip/:slug/roster`) — public roster.
- `src/pages/VipRegister.tsx` (`/vip-register`) — public group landing.
- Edge fn `generate-vip-slots` — Monday midnight cron.

### 5. Milestones today
- Table: `milestones` (entry_type milestone|deploy, member_name, friend_*, deploy_*, etc.)
- Component: `src/components/dashboard/MilestonesDeploySection.tsx` — mounted on `/wig` only.
- No "pending milestone" flag. Sales today come from `intros_run` (result_canon='SALE', buy_date=today).

### 6. POS referral ask today
- Fields on `intros_booked`: `coach_referral_asked`, `coach_referral_names`, `referral_ask_followup_pending`.
- Component: `src/components/dashboard/ReferralAskTracker.tsx` — mounted on `/wig` only.
- "Ask owed" = sale today where `coach_referral_asked` is null/false.

---

## Schema migration

```sql
-- 1. vip_members (central profile)
CREATE TABLE public.vip_members (
  id uuid PK default gen_random_uuid(),
  first_name text NOT NULL,
  last_name text,
  full_name text generated always as (...) stored,
  phone text,
  phone_normalized text generated always as (regexp_replace(coalesce(phone,''),'\D','','g')) stored,
  email text,
  birthday date,
  is_vip boolean NOT NULL default true,
  vip_last_interaction_at timestamptz,
  vip_notes text,
  vip_referral_count int NOT NULL default 0,
  vip_milestones jsonb NOT NULL default '[]',
  created_by text NOT NULL default 'system',
  created_at timestamptz NOT NULL default now(),
  updated_at timestamptz NOT NULL default now(),
  deleted_at timestamptz
);
CREATE UNIQUE INDEX vip_members_phone_uniq ON vip_members(phone_normalized) WHERE phone_normalized <> '' AND deleted_at IS NULL;

-- 2. vip_registrations.vip_member_id fk
ALTER TABLE vip_registrations ADD COLUMN vip_member_id uuid REFERENCES vip_members(id);

-- 3. Backfill: dedupe by normalized phone, fallback to lower(first||' '||last)
-- (one INSERT...SELECT DISTINCT ON, then UPDATE registrations)

-- 4. vip_touchpoints
CREATE TABLE public.vip_touchpoints (
  id uuid PK default gen_random_uuid(),
  vip_member_id uuid NOT NULL REFERENCES vip_members(id) ON DELETE CASCADE,
  staff_name text NOT NULL,
  touchpoint_type text NOT NULL CHECK (touchpoint_type IN ('text','call','in_person','email','class_visit')),
  notes text,
  created_at timestamptz NOT NULL default now()
);
CREATE INDEX ON vip_touchpoints(vip_member_id, created_at DESC);

-- 5. Trigger: on insert touchpoint, update vip_members.vip_last_interaction_at = now()
-- 6. RLS: public select/insert/update/delete on both tables (matches project pattern)
```

`vip_lifetime_visits` is **live-computed** by querying `intros_run` matched on phone_normalized OR (lower(member_name) = lower(full_name)).

---

## VIP tab build

**Route**: `/vips` (and SA redirect from `/pipeline`).
**Nav**: visible to SA + Admin (full) and Coach (read-only, scoped to their classes).

```
src/pages/Vips.tsx                          (route shell)
src/features/vips/VipsPage.tsx              (3 sub-tabs)
src/features/vips/VipsTodayTab.tsx          (default: Class Today / Overdue Touch (>14d) / This Week)
src/features/vips/VipsAllTab.tsx            (sortable list, filter chips, search)
src/features/vips/VipsScheduleTab.tsx       (renders moved VipSchedulerTab + public link card)
src/features/vips/VipProfilePage.tsx        (route /vips/:id — header + 7 collapsible sections)
src/features/vips/LogTouchpointDialog.tsx   (5 types, notes, auto-save)
src/features/vips/useVipsData.ts            (queries vip_members + joins)
```

Coach scope: `VipsPage` reads `user.role`; if Coach, all queries filter to `vip_member_id` IN (vip_registrations attached to bookings where `coach_name = user.name`); profile renders all sections read-only.

---

## MyDay redesign — Today's Actions

New top section above existing content:

```
src/features/myDay/TodaysActions.tsx          (chip stack, role-routed)
src/features/myDay/useTodaysActions.ts        (per-role queries)
src/features/myDay/AdminPersonPicker.tsx      (Koa-only switch)
```

**Coach chips** (computed for `user.name`):
- Score chip: `intros_run` from yesterday+today where `coach_name = user.name` AND no `fv_scorecards` row exists. Tap → `/scorecards/me` form pre-filled.
- Formal eval owed: count `fv_scorecards` per coach this month where `eval_type='formal_eval'`; chip per coach below 2-floor (only if user has eval role). Tap → scorecard form formal mode.
- Follow-up overdue: `follow_up_queue` where `coach_owner = user.name`, `scheduled_date <= today`, open. Tap → opens `ScriptPickerSheet` from F/U flow.

**SA chips** (for `user.name`):
- Mark milestone: `intros_run` today where `result_canon='SALE'`, `intro_owner = user.name`, NOT in `milestones` (match by member_name). Tap → opens `MilestonesDeploySection`-style add dialog pre-filled.
- POS referral ask: `intros_run` today where SALE, `intro_owner = user.name`, joined `intros_booked.coach_referral_asked` IS NOT TRUE. Tap → opens referral ask dialog (writes `coach_referral_asked=true`, optional names).

**Admin (Koa)**: sees own chips + person picker; switching person re-runs same queries with that name and renders that role's chip set.

**Empty states** as specified.

VIP touchpoints intentionally absent from MyDay — they live in `/vips`.

Coach role currently can't reach `/my-day` (redirected to `/coach-view`). To deliver coach chips, **stop redirecting**: drop `blockCoach` on `/my-day` and render `TodaysActions` first; existing coach surfaces (`/coach-view`, `/my-intros`) remain.

Coach BottomNav: add `My Day` as the leading item.

---

## Pipeline cleanup

- `BottomNav`: remove `/pipeline` from SA `visibleItems`. Keep for Admin. Add `/vips` for both SA + Admin and (read-only) Coach.
- `App.tsx`: SA hitting `/pipeline` → redirect to `/vips`. Admin keeps full Pipeline.
- `PipelineFiltersBar`: drop `vip_class` and `vip_scheduler` triggers. `usePipelineData` keeps the data (not all VIP context can be removed because journey VIP detection still uses it for diagnostic), but tab UI no longer surfaces them.
- `PipelineNewLeadsTab` stays as Admin diagnostic; the SA-facing equivalent already exists in MyDay.

---

## Downstream

- Update `useDuplicateDetection` and `ClientNameAutocomplete`: query `vip_members` (preferred) instead of `vip_registrations` for the autocomplete pool. Backwards-compat with current behavior.
- `RescheduleClientDialog` VIP mode: link new booking to `vip_member_id` not just `vip_registrations`.
- `Wig.tsx`: keep `MilestonesDeploySection` and `ReferralAskTracker` unchanged — these are roll-up views, not action chips. WIG totals (Level-3 scorecards / milestones / referral asks) untouched.
- `Reports.tsx`, `Recaps.tsx`: no schema removals, queries unaffected.

---

## Files touched (planned)

**New**
- supabase migration (vip_members, vip_touchpoints, backfill, trigger)
- `src/pages/Vips.tsx`, `src/pages/VipProfile.tsx`
- `src/features/vips/{VipsPage,VipsTodayTab,VipsAllTab,VipsScheduleTab,VipProfilePage,LogTouchpointDialog,useVipsData}.tsx`
- `src/features/myDay/{TodaysActions,useTodaysActions,AdminPersonPicker}.tsx`

**Edited**
- `src/App.tsx` (routes, SA redirect, allow Coach on `/my-day`)
- `src/components/BottomNav.tsx` (add VIPs, drop Pipeline for SA, add My Day for Coach)
- `src/features/myDay/MyDayPage.tsx` (mount `<TodaysActions />` at top)
- `src/features/pipeline/components/PipelineFiltersBar.tsx` (remove vip tabs)
- `src/features/pipeline/PipelinePage.tsx` (remove vip tab branches)
- `src/features/pipeline/usePipelineData.ts` (drop vip_scheduler/vip_class default cases)
- `src/hooks/useDuplicateDetection.ts` (read from vip_members)
- `src/components/RescheduleClientDialog.tsx` (write vip_member_id)

**Moved (re-exported in place to avoid breaking imports)**
- `VipSchedulerTab` → re-exported from `src/features/vips/VipsScheduleTab.tsx`
- `VipPipelineTable` → reused inside VIP profile / session detail

## Confirmations baked in
- Overdue touch: **14 days**
- `is_vip`: lives on new `vip_members` (no `leads.is_vip`)
- `vip_lifetime_visits`: **live-computed** from `intros_run`
- Milestone chip source: `intros_run` SALE today not in `milestones`
- Referral chip source: `intros_run` SALE today missing `coach_referral_asked`
