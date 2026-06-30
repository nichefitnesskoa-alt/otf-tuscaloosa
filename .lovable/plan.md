## Goal
Add two summary rows above the existing "Total (All Sources)" row in the Lead Source Analytics card so Koa can see at a glance how many bookings/showed/sold came from self-generated leads (SGL) vs non-SGL (passive web traffic).

## SGL classification rule
Single canonical helper, used everywhere this distinction is needed.

- **Non-SGL** = `Online Intro Offer (self-booked)` only. This is the one passive web-form source where the lead found us, not the other way around.
- **SGL** = every other current lead source, including:
  - Member Referral, Member Referral (5 class pack)
  - VIP Class
  - Event
  - Instagram DM, Instagram DMs
  - Lead Management
  - Cold Lead Re-engagement
  - Manual Entry
  - My Personal Friend I Invited
  - Business Partnership Referral
  - Any `... (Friend)` variant — including `Online Intro Offer (self-booked) (Friend)`, because the "(Friend)" tag means a current member/staff brought them in, which is staff-generated.

Unknown / future sources default to SGL (safer for staff credit), with `Online Intro Offer (self-booked)` as the only hardcoded Non-SGL exception.

## Files

### New: `src/lib/metrics/sglClassification.ts`
Single source of truth.
```ts
export function isSglLeadSource(source: string | null | undefined): boolean {
  const s = (source ?? '').trim();
  if (!s) return false;
  // Only the bare self-booked web form is Non-SGL.
  // The "(Friend)" variant means a member/staff brought them in → SGL.
  if (s === 'Online Intro Offer (self-booked)') return false;
  return true;
}
export const NON_SGL_SOURCES = ['Online Intro Offer (self-booked)'];
```

### Edit: `src/components/dashboard/LeadSourceChart.tsx`
- Import `isSglLeadSource`.
- After computing `sorted`, derive two aggregates over the same `LeadSourceData[]` (booked/showed/sold + people arrays concatenated) — `sglTotal` and `nonSglTotal`.
- Render order inside `<CardContent>`:
  1. Existing per-source `SourceRow`s
  2. New separator + two `SourceRow`s: **"SGL Total (Staff-Generated)"** and **"Non-SGL Total (Self-Booked Web)"**, both with `highlight` styling tone (use a subtle differentiator — SGL highlighted green-tinted via existing `highlight` prop; Non-SGL with a neutral border).
  3. Existing "Total (All Sources)" row (unchanged).
- Drilldowns on the new rows reuse the existing `openDrill` path with titles `"SGL — Booked/Showed/Sold"` and `"Non-SGL — Booked/Showed/Sold"`, populated from the concatenated people arrays.
- Small caption under the new rows: `"SGL = staff-generated. Non-SGL = self-booked web form."`

No changes to `useDashboardMetrics`, no DB changes, no other surfaces touched. The classification helper is exported so it can be reused later (WIG, Studio funnel) without re-defining the rule.

## Coherence proof plan
After edit, verify with `psql` for the active dashboard date range:
- SUM(booked) for sources where `isSglLeadSource = true` matches the SGL Total row.
- SUM(booked) for `Online Intro Offer (self-booked)` matches Non-SGL Total row.
- SGL + Non-SGL = existing Total (All Sources) for booked, showed, sold.

## Out of scope
- No changes to attribution, commission, or other pages.
- No new DB columns. Classification is derived at read time.
- "(Friend)" variants stay tagged as their own source rows — only the new summary rows aggregate them.
