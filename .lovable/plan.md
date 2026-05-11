# Multi-lane Owners + Honesty Disclaimers on Own It

## CONFIRM THIS VALUE — answered
There is no persisted field tracking consecutive incomplete submissions. `laneHealth.ts` only computes per-meeting status (green/amber/red). The "Add another lane" gate must be **derived fresh at render** from `table_owner_entries`:

- Look back the **2 most recent past meetings** (meeting_agendas with `meeting_date < today`, ordered desc, limit 2).
- For each of the user's existing lanes (`table_owners` rows where `staff_id = me`), check the entry for those 2 meetings.
- A lane is "incomplete" for a week if: no entry row, OR `submitted_at` is null, OR any of `last_week_update / this_week_focus / ideas / ask` is null/blank.
- If **any** of the user's current lanes has incomplete in **both** of the last 2 meetings → disable "Add another lane".

Helper goes in `src/lib/table/laneCompletion.ts` as `useRecentLaneCompleteness(staffId)` returning `{ blocked: boolean }`.

## Schema change
Drop `UNIQUE (staff_id)` on `table_owners`. Add `UNIQUE (staff_id, lane_name)`. No data migration.

## Multi-lane code changes

**`useTheTable.ts` — `useActiveOwners()`**
- Order by `display_name, lane_name` so the same person's lanes sit adjacent.
- Lane health stays keyed on `owner.id` (per-row), no logic change. Confirmed: `useLaneHealth` already iterates `owners` and writes `map[o.id]` — multi-row works as-is.

**`ManageOwnersDialog.tsx`**
- Staff picker excludes only exact `(staff_id, lane_name)` pairs already active, not the whole staff member. A person can be added a second time with a different lane.
- Each row continues to soft-remove (`is_active = false`) only that single lane row.

**`TheTable.tsx`**
- Replace `myOwner` (single) with `myOwners` (array): `owners.filter(o => o.display_name === user?.name)`.
- Render one "Your update" card per lane in `myOwners`, each with its own `OwnerEntryEditor` keyed on `owner_id`. Each card title: `Your update — {lane_name}`.
- The "everyone else" carousel filter changes from `o.id !== myOwner?.id` to `!myOwners.some(m => m.id === o.id)`.
- The wins composer at line 447 currently writes `owner_id: myOwner?.id` — change to a dropdown when `myOwners.length > 1`, defaulting to first lane. (Wins are tied to a specific lane.)
- `MyRolePicker` becomes `MyLanesManager`: lists all of `myOwners` with a small "Remove this lane" affordance per row, plus an "Add another lane" button.

**"Add another lane" flow (own card only)**
- Button gated by `useRecentLaneCompleteness(user.staffId).blocked`. When blocked, button is disabled with subtext: *"Complete your current lanes for two weeks first."*
- On click, if `myOwners.length >= 2` show a small confirm first: *"Most people max out at 2 lanes — sure you can carry a third?"*
- Then open the commitment modal (always, for self-claim — Admin assignment via Manage Owners bypasses):

  > **One more lane is a real commitment.**
  >
  > The room notices when a lane goes quiet. Two cards with half answers is harder to recover from than one card done well. The people who carry multiple lanes successfully aren't doing more — they're just clearer on what moves the needle in each one.
  >
  > Ask yourself one question before adding this: is your current lane moving every week without being reminded?
  >
  > If yes, you're probably ready.
  >
  > "Most people max out at two lanes. That's not a ceiling — that's just what the data shows."
  >
  > [**Add the lane**] [**Not yet**]

- "Add the lane" reveals the lane picker (same `LANE_SUGGESTIONS` datalist used elsewhere). Submit inserts a new `table_owners` row `{ staff_id: me, lane_name, category: resolved-from-LANE_SUGGESTIONS }`.

**`exportOwnIt.ts`**
- Within each domain, sort by `display_name` then `lane_name`. Multi-lane Owners produce two adjacent blocks per domain naturally.

**`supabase/functions/table-sunday-reminder/index.ts`**
- Iterate per `table_owners.id`, not per `staff_id`. Same staff member receives a separate reminder per lane missing a submission. Group by phone/email when sending so they get one message listing both lanes.

## Honesty disclaimers (inline subtext, muted, no modals)

All rendered as `<p className="text-xs text-muted-foreground mt-1">…</p>` directly above/beside the relevant input. Never as Tooltip/Popover/Modal except where explicitly noted.

| Surface | Location | Copy |
|---|---|---|
| Coach Self-Eval | Above the scoring inputs in `FVScorecardForm` (or wherever the eval_type='self_eval' bullets render) | *Wrong and honest beats right and hidden. Score what actually happened.* |
| MyDay milestones | In `ClassMilestoneChecks` header subtext (and `AddCelebrationDialog` if separate) | *If it didn't happen, mark it. We can only fix what's real.* |
| Leads/outreach tracking | Top of `daily_lead_log` and `daily_outreach_log` entry forms in MyDay | *Log the real number. We can work with honest. We can't work with hidden.* |
| Own It submission | Above the four questions in `OwnerEntryEditor` | *Say the thing you'd normally soften.* |
| Lane health amber/red | Tooltip on the existing health dot (this one is the only Tooltip) | *Yellow is not failure. Yellow is honest.* |

I will grep for the actual component file names for Coach Self-Eval, milestones, and lead/outreach logs during the build to confirm placement; the disclaimers go in the same component as their input, never in a separate wrapper.

## Downstream cleanup audit (during build)
- Grep every `myOwner` reference and convert to array-aware logic. Confirmed locations: `TheTable.tsx` lines 71/72/199/203/206/211/258/447/470/476/482/485/493/497/524/527/546/547. No other files reference `myOwner`.
- Confirm domain labels (`LANE_CATEGORIES`) consistent across `TheTable.tsx`, `TheTableHistory.tsx`, `useTheTable.ts`, `ManageOwnersDialog.tsx`, `exportOwnIt.ts`, `table-sunday-reminder`. Already canonical from prior audit — re-verify only.
- Carry-forward (`useOpenCarryForward`) is already keyed on `owner_id` per row, so multi-row is automatic. Verify during build.

## Files touched
- New migration: drop `table_owners_staff_id_key`, add `UNIQUE (staff_id, lane_name)`.
- `src/lib/table/laneCompletion.ts` (new) — `useRecentLaneCompleteness` helper.
- `src/hooks/useTheTable.ts` — order-by tweak in `useActiveOwners`.
- `src/components/table/ManageOwnersDialog.tsx` — pair-based exclusion.
- `src/pages/TheTable.tsx` — `myOwners` array, per-lane cards, "Add another lane" with commitment modal + 3rd-lane confirm + completeness gate, wins-composer lane picker.
- `src/lib/table/exportOwnIt.ts` — secondary sort by `lane_name`.
- `supabase/functions/table-sunday-reminder/index.ts` — per-lane reminders, grouped per recipient.
- Disclaimer additions in: `src/features/myDay/ClassMilestoneChecks.tsx` (+ AddCelebration if separate), the daily lead log + daily outreach log components in MyDay, the OwnerEntryEditor in `TheTable.tsx`, the Coach Self-Eval form, and the lane health dot.

## Out of scope
- No "primary lane" weighting — every lane is equal.
- No bulk action to copy answers across someone's lanes.
- No notifications redesign beyond the per-lane Sunday reminder.
