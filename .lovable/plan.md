

# Continuous Deduplication, Auto Intro Owner, and Manual Referrals

## Problem Summary

1. **Deduplication only runs on-demand** — `detectDuplicate` / `runDeduplicationForLead` only fires when the Leads tab mounts or when an admin clicks "Run Dedup." New leads that arrive later are never re-checked against newly-created bookings.

2. **No duplicate warning on lead cards** — If a lead matches someone already booked, there's no visible indicator on the card itself (only inside the detail sheet after manual "Find in System").

3. **Intro owner is always set to `editedBy` (the SA logging the outcome)** — In `applyIntroOutcomeUpdate` line 140, `intro_owner: params.editedBy` is hardcoded when creating a new run. The intro owner on first intro should be the person who ran the intro (same as `editedBy`) EXCEPT when lead source is "My Personal Friend I Invited" — in that case the intro owner should be the SA who booked it (`booked_by`).

4. **No way to manually enter referrals** — The `ReferralTracker` admin component only displays referrals; there's no "Add Referral" form.

---

## Changes

### 1. Continuous Background Deduplication

**File: `src/features/myDay/MyDayNewLeadsTab.tsx`** and **`src/features/pipeline/components/PipelineNewLeadsTab.tsx`**

Currently both tabs run dedup in a `useEffect` on mount. Add:
- A **realtime subscription** on the `leads` table so that when a new lead is inserted, dedup runs immediately against current bookings.
- A **periodic re-check** (every 5 minutes) that re-runs dedup on all `new` and `contacted` stage leads, catching cases where a booking was created after the lead was ingested.

**File: `src/lib/leads/detectDuplicate.ts`**
- Add a new exported function `runContinuousDedup()` that:
  1. Fetches all leads in `new`, `contacted`, `flagged` stages
  2. Runs `runDeduplicationForLead` on each
  3. Returns a count of newly-flagged leads

**File: `supabase/functions/import-lead/index.ts`**
- After inserting a new lead, run inline dedup against `intros_booked` by phone and name before returning. If a match is found, set `duplicate_confidence` and `duplicate_notes` on the lead immediately at ingestion time.

### 2. Duplicate Warning Badge on Lead Cards

**File: `src/components/leads/LeadCard.tsx`**
- Read `lead.duplicate_confidence` and `lead.duplicate_notes` from the lead object (already on the `leads` table).
- When `duplicate_confidence` is `HIGH` or `MEDIUM`, show a warning badge: "⚠ May already be in system" with the `duplicate_notes` as a tooltip.
- When `HIGH`, use a destructive badge. When `MEDIUM`, use a warning-colored badge.

### 3. Auto-Set Intro Owner on First Run

**File: `src/lib/domain/outcomes/applyIntroOutcomeUpdate.ts`**

When creating a new run (line 128-158), change the `intro_owner` logic:

```
Current:  intro_owner: params.editedBy
```

New logic:
1. Fetch the booking's `lead_source` and `booked_by`
2. If `lead_source === 'My Personal Friend I Invited'`, set `intro_owner` to `booked_by` (the SA who personally invited them gets credit)
3. Otherwise, set `intro_owner` to `params.editedBy` (the SA who ran the intro)

Also sync `intro_owner` back to the booking record via `intros_booked.intro_owner` update — same as current behavior but with the corrected value.

Additionally, after creating the run, update the booking's `intro_owner` and `intro_owner_locked` to match:
```ts
await supabase.from('intros_booked').update({
  intro_owner: resolvedOwner,
  intro_owner_locked: true,
}).eq('id', params.bookingId);
```

### 4. Manual Referral Entry in ReferralTracker

**File: `src/components/admin/ReferralTracker.tsx`**

Add an "Add Referral" button in the header that opens a small inline form with:
- **Referrer Name** — text input (with `ClientNameAutocomplete` for pipeline search + free-text)
- **Referred Name** — text input (same autocomplete pattern)
- **Save** button that inserts into the `referrals` table

This allows admins to manually log referral relationships that weren't captured during booking (e.g., "Mary Bennett Waller referred Brinkli Wood").

---

## Files Changed

| File | Change |
|------|--------|
| `src/lib/domain/outcomes/applyIntroOutcomeUpdate.ts` | Fix intro_owner: use `booked_by` when lead source is "Personal Friend", otherwise `editedBy`. Sync owner to booking. |
| `src/lib/leads/detectDuplicate.ts` | Add `runContinuousDedup()` for periodic background checks |
| `src/features/myDay/MyDayNewLeadsTab.tsx` | Add realtime subscription + 5-min interval for continuous dedup |
| `src/features/pipeline/components/PipelineNewLeadsTab.tsx` | Same realtime + interval dedup |
| `src/components/leads/LeadCard.tsx` | Show duplicate warning badge when `duplicate_confidence` is HIGH/MEDIUM |
| `src/components/admin/ReferralTracker.tsx` | Add "Add Referral" form with name autocomplete |
| `supabase/functions/import-lead/index.ts` | Run inline dedup at lead ingestion time |

