## Diagnosis (real DB)

**1. Lead source values in DB (counts, non-deleted intros_booked):**


| Source                                    | Count | In/Out      |
| ----------------------------------------- | ----- | ----------- |
| Online Intro Offer (self-booked)          | 197   | OUT         |
| VIP Class                                 | 149   | IN          |
| Instagram DMs                             | 68    | IN          |
| Member Referral                           | 54    | IN          |
| Instagram DMs (Friend)                    | 51    | IN          |
| Lead Management                           | 32    | OUT         |
| My Personal Friend I Invited              | 25    | IN          |
| Lead Management (Friend)                  | 12    | IN          |
| VIP Class (Friend)                        | 6     | IN          |
| Business Partnership Referral             | 6     | IN          |
| Online Intro Offer (self-booked) (Friend) | 2     | **CONFIRM** |
| Member Referral (5 class pack)            | 1     | IN          |
| My Personal Friend I Invited (Friend)     | 1     | IN          |
| Business Partnership Referral (Friend)    | 1     | IN          |


**Question A:** does `Online Intro Offer (self-booked) (Friend)` count as self-generated (someone the SA brought in *as a friend* of a self-booker)? My read of your rule says OUT (it's still a self-booked variant); confirm.

**2. Date field for "when the lead was booked":** intros_booked has `created_at` (row insertion) and `class_date` (when the class is). Per your wording "the week its booking/created date falls in", I'll use `**created_at**` (CST week bucket). **Confirm.**

**3. VIP link:** `intros_booked.vip_session_id` → `vip_sessions.id` (FK exists). Confirmed.

**4. vip_sessions SA-setup field:** does NOT exist today. `coach_name` is the only attribution column. Confirmed — we add it.

---

## Plan

### DB migration

- Add `vip_sessions.sa_setup_name TEXT NULL`. No backfill, no constraint.

### Canonical helper (single source of truth)

Create `src/lib/sa/leadsBooked.ts`:

- `EXCLUDED_LEAD_SOURCES = ['Lead Management', 'Online Intro Offer (self-booked)', 'Online Intro Offer (self-booked) (Friend)']` (pending Question A)
- `isSelfGeneratedLeadBooked(booking)` — returns true if `lead_source` is not excluded and not soft-deleted and not `ignore_from_metrics`.
- `getLeadBookedCreditSa(booking, vipSession?)` — returns `vipSession?.sa_setup_name` when `lead_source === 'VIP Class'` or `'VIP Class (Friend)'` and a session is linked; otherwise `booking.booked_by`. Returns null when no creditable SA (e.g. VIP with unset sa_setup_name → uncredited, not double-credited).
- `aggregateLeadsBookedBySa(bookings, vipSessions, weekStartYMD, weekEndYMD)` — buckets by `created_at` in **America/Chicago**, Monday-start weeks, returns `Map<saName, count>`.
- Uses existing CST helpers from `src/lib/dateUtils.ts` and `src/lib/pay-period.ts`. No new date logic.

### Hook

Create `src/hooks/useSaLeadsBooked.ts`:

- Fetches `intros_booked` (id, lead_source, booked_by, vip_session_id, created_at, ignore_from_metrics, deleted_at) joined with `vip_sessions(sa_setup_name)` for the date range.
- Returns `{ rows: { sa, count, members[] }[], total, loading }` using the canonical helper.
- React Query key: `['sa-leads-booked', rangeStart, rangeEnd]`. Invalidated on `vip_sessions` and `intros_booked` writes via existing `notifyDataChanged`.

### Target persistence

- Reuse the per-period `studio_settings` pattern from `wig_lead_target` (already shipped this session).
- Key: `sa_leads_booked_target:${YYYY-MM}` (per-SA weekly target). Default 4.
- Stored once per period, editable inline from WIG SA section, identical UX to existing lead target editor.

### WIG SA leaderboard UI

Edit `src/components/wig/WigSaLeaderboard.tsx`:

- Add 3rd header tile: "Leads Booked" (total for period) — drillable to per-SA list.
- Add "Leads" column to the SA table, between SA name and Milestones. Drill = members booked, grouped by week, showing source.
- Show target chip: "of 4/wk" (or whatever the persisted value is). Color logic: on-pace green / behind amber, matching existing pacing convention.
- No change to Milestones / POS Referral Asks columns.

### My Day VIP drawer

Edit `src/features/myDay/VipRegistrationsSheet.tsx`:

- Add a Select beneath the existing "Who coached this VIP class?" labeled **"Which SA found and set up this VIP class?"**
- Options from `useActiveStaff()` filtered to SA + Both + Admin (same filter pattern as other SA pickers).
- Auto-save on change to `vip_sessions.sa_setup_name`. Show inline "Saved" 2s.
- Helper text: "This SA gets credit for every intro booked from this VIP class toward their weekly leads booked."
- Fire `notifyDataChanged(['vip_sessions', 'sa-leads-booked'])`.

### Reach-map (consumers of leads-booked)

- WIG SA leaderboard tile + column (new)
- WIG SA drill modal (new)
- (Future) Own It / per-SA detail page can import the same helper — not changed in this build.

---

## Verification (coherence proof targets)

1. Report excluded set after Question A is answered.
2. Pick one SA with current bookings, hand-count their self-generated leads booked for current CST week, confirm helper returns same number.
3. Set a VIP session's `sa_setup_name` to that SA, book a test VIP-class intro under a *different* booker, confirm SA's count rises by exactly 1 and the booker's does not.
4. Confirm a `Lead Management` and an `Online Intro Offer (self-booked)` booking do NOT increment any SA's count.
5. Report SA's number at each step. All agree: yes/no.

---

## Confirms needed before I start

- **A.** Does `Online Intro Offer (self-booked) (Friend)` (2 rows) count? My read: OUT. Confirm.
- **B.** Date field = `intros_booked.created_at`? Confirm (alternative would be a manual booking date, which doesn't exist as a column).
- **C.** Helper name `isSelfGeneratedLeadBooked` / file `src/lib/sa/leadsBooked.ts` — OK?
- **D.** Target storage key `sa_leads_booked_target:${YYYY-MM}`, default 4 — OK?  
  
A. Online Intro Offer (self-booked) (Friend) counts IN.
     The "(Friend)" suffix means an SA did the work to bring that
     friend in, even off a self-booked source. ANY source with
     "(Friend)" is a self-generated lead.
     The EXCLUDED set is exactly two sources, both bare/no-effort:
       - Lead Management
       - Online Intro Offer (self-booked)
     Everything else counts IN, including every "(Friend)" variant.
     So EXCLUDED_LEAD_SOURCES = ['Lead Management',
     'Online Intro Offer (self-booked)'] — remove the (Friend)
     variant from the excluded list.
  B. created_at — confirmed.
  C. Helper name and file — approved.
  D. Target key and default 4 — approved. 4 is per-SA per-week.
     Any team rollup tile must show 4 × active SA count from
     useActiveStaff, never a hardcoded team number.
  Build it. Then run the full coherence proof, including the VIP
  double-credit check, and confirm that Online Intro Offer
  (self-booked) (Friend) now counts while plain Online Intro Offer
  (self-booked) and Lead Management do not.