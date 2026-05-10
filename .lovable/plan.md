# Build 4D — Manual Milestone Coverage Entry (SA Honor System)

## Why
Build 4C deferred "100% Coverage" because no automatic roster source exists. Confirmed: coverage will be **manual, honor-system entry** by the SA at shift close-out — they self-report milestones celebrated vs. milestones missed for that shift. This unlocks the deferred coverage metric without inventing a roster pipeline.

## Scope (additive only — no removals)

### 1. Database (one migration)
Add two nullable columns to a per-shift record. Since `shift_task_completions` is per-task, create a new sibling table for per-shift self-reports:

```
shift_coverage_reports
  id uuid pk
  sa_name text not null
  shift_date date not null
  shift_type text not null
  milestones_celebrated int not null default 0
  milestones_missed int not null default 0
  notes text
  created_by text not null
  created_at timestamptz not null default now()
  updated_at timestamptz not null default now()
  unique (sa_name, shift_date, shift_type)
```
RLS: open policies matching existing `shift_task_completions` pattern (name-based auth). Trigger for `updated_at`.

### 2. SA Close-Out UI (`CloseOutShift.tsx`)
Add a **"Milestone Coverage (honor system)"** card at the end of close-out:
- Two number inputs: "Celebrated" and "Missed" (44px tap targets, bordered, auto-save on blur)
- Optional notes textarea ("Who got missed and why?")
- Inline "Saved" 2s confirmation
- Helper copy: "Be honest. This is how we get better — not a gotcha."
- Computed coverage % shown live: `celebrated / (celebrated + missed)`

### 3. SA Leaderboard (`WigSaLeaderboard.tsx`)
Add a **Coverage %** column (sum celebrated / sum celebrated+missed across the period). Show "—" when no reports. Sort remains referral-rate primary; coverage is informational. Add tooltip explaining honor-system source.

### 4. SA Detail Page (`SaDetail.tsx`)
- New tile: "Coverage %" (period total + count of shifts reported)
- New row in Recent Shifts table: celebrated / missed / coverage % per shift
- Link any shift with `missed > 0` to display the SA's notes inline

### 5. Canonical Helper
Create `src/lib/sa/coverage.ts`:
```
export interface CoverageTotals { celebrated:number; missed:number; pct:number|null; reportedShifts:number }
export function computeCoverage(reports: ShiftCoverageReport[]): CoverageTotals
```
Used by leaderboard, detail page, and any future surfaces. Single source of truth — per coherence rule.

### 6. Hook
Extend `useSaLeaderboard.ts` to fetch `shift_coverage_reports` in the same date window and merge per-SA totals via `computeCoverage`.

## Coherence Map (reach)
- **Reads** new table: leaderboard, SA detail, close-out (current shift only)
- **Writes**: close-out form
- **Computes**: `computeCoverage` helper (single canonical)
- **Cross-page check**: leaderboard coverage % for SA = SA detail page coverage % for same date range
- **Role permissions**: SA sees own close-out; Admin sees all on leaderboard; Coach unaffected (WIG SA tab already gated)

## Out of Scope
- No streak badge for 100% coverage (per Build 4C answer: "No — count only")
- No retro-edit UI for past shifts (admin can edit via DB if needed; can add later)
- No milestone-eligible roster import — explicitly manual

## CONFIRM THESE VALUES
1. **Where does the coverage card sit in close-out?** Suggest: at the very end, after task checklist, before submit.
2. **Should missed > 0 trigger a soft warning** ("Add a note so we can follow up")? Suggest: yes, soft prompt, not blocking.
3. **Default values on a new shift report**: both 0 (SA must enter), or leave null until touched? Suggest: null until touched, so unreported shifts show "—" not "0%".

## Verification Plan
- Insert test report: 8 celebrated / 2 missed → 80% on leaderboard and detail
- Two shifts same SA: (8/2) + (10/0) → 18/20 = 90% aggregate on leaderboard
- Unreported shift count matches `shift_task_completions` shifts minus `shift_coverage_reports` shifts
- Coach role cannot see SA leaderboard column changes (WIG SA tab already SA/Admin)
- Realtime: report saved on close-out appears on admin leaderboard without reload (subscribe to new table)

## Files
**Created**: `supabase/migrations/<ts>_shift_coverage_reports.sql`, `src/lib/sa/coverage.ts`, `src/lib/sa/__tests__/coverage.test.ts`
**Edited**: `src/components/dashboard/CloseOutShift.tsx`, `src/components/wig/WigSaLeaderboard.tsx`, `src/pages/SaDetail.tsx`, `src/hooks/useSaLeaderboard.ts`
