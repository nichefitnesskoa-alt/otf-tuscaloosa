# Follow-up Implementation Plan: Steps 1–7

## Actual Current State (verified by file inspection)

The following were claimed as "done" but are **NOT in the repo**:

- `src/lib/canon/canonFallback.ts` — **does not exist**
- `src/lib/datetime/formatTime.ts` — **does not exist**
- `src/lib/outcomes/commissionRules.ts` — **does not exist**

The following ARE confirmed done:

- `src/features/myDay/MyDayShiftSummary.tsx` — exists, wired correctly
- `src/pages/Recaps.tsx` — GroupMe card and Lead Measures legend line are removed (search confirmed)
- `shift_recaps` migration — unique constraint exists

This means Steps 1–7 below also need to create the three utility files first, since `OutcomeDrawer.tsx` imports from them.

---

## Step 1 — Create missing utility files first

These are prerequisites for Step 1 (OutcomeDrawer) and must be created before modifying any component.

### `src/lib/outcomes/commissionRules.ts` (new)

```typescript
export function computeCommission({ membershipType }: { membershipType: string | null }): number {
  const rules: Record<string, number> = {
    'Premier + OTbeat': 15,
    'Premier': 7.50,
    'Elite + OTbeat': 12,
    'Elite': 6,
    'Basic + OTbeat': 3,
    'Basic': 0,
  };
  return membershipType ? (rules[membershipType] ?? 0) : 0;
}
```

### `src/lib/datetime/formatTime.ts` (new)

Uses `date-fns` (already installed). Handles both full ISO strings and bare `HH:mm` strings safely:

```typescript
export function formatTime12h(dateIso: string | null | undefined): string
export function formatDateShort(dateIso: string | null | undefined): string
export function isTodayStartAt(dateIso: string | null | undefined): boolean
export function isThisWeekStartAt(dateIso: string | null | undefined): boolean
```

- `formatTime12h` parses full ISO timestamps (e.g. `2026-02-18T09:15:00`) AND bare `HH:mm` strings (e.g. `09:15`). Returns `"9:15 AM"`. If null/undefined returns `"—"`.
- `formatDateShort` returns `"Feb 17"`. If null returns `"—"`.
- `isTodayStartAt` compares the date portion only to today.
- `isThisWeekStartAt` returns true if the date is tomorrow through end of this week (not today).

### `src/lib/canon/canonFallback.ts` (new)

Exact exports as specified in the original prompt.

---

## Step 2 — `src/components/myday/OutcomeDrawer.tsx`

**Current state:** Has old outcome options (`Sold - Unlimited`, `Sold - Premier`, `Sold - Basic`), manual commission `Input` field, and no "Booked 2nd intro" flow.

**Changes:**

1. Import `computeCommission` from `@/lib/outcomes/commissionRules.ts`
2. Import `formatDateShort`, `formatTime12h` from `@/lib/datetime/formatTime.ts`
3. Import `Calendar` from `@/components/ui/calendar` and `Popover`/`PopoverContent`/`PopoverTrigger` from `@/components/ui/popover` for date picker
4. Replace `OUTCOME_OPTIONS` with the exact new list:
  - Sale row: `Premier + OTbeat`, `Premier`, `Elite + OTbeat`, `Elite`, `Basic + OTbeat`, `Basic`
  - Non-sale row: `Didn't buy`, `No-show`, `Not interested`, `Follow-up needed`, `Booked 2nd intro`
5. Remove `const [commission, setCommission] = useState('')`
6. Add `const commission = computeCommission({ membershipType: isSale ? outcome : null })` — computed value, not state
7. Replace the `{isSale && <Input type="number" .../>}` block with a read-only line: `<p className="text-sm text-muted-foreground">Commission: ${commission.toFixed(2)}</p>` — rendered always when outcome is selected, not just on sale (shows $0.00 for non-sale)
8. Add state: `secondIntroDate`, `secondIntroTime`, `secondIntroCoach`, `secondIntroConfirmed`
9. When outcome is `Booked 2nd intro`: render date picker (shadcn Calendar in Popover), time input (text, HH:mm), coach name text input
10. After successful save with `Booked 2nd intro`: show confirmation line `"2nd intro booked: [formatDateShort(date)] at [formatTime12h(time)] with [coach]"` in place of inputs
11. Update `handleSave`: remove `commissionAmount` from `applyIntroOutcomeUpdate` call (commission is now computed inside that function), pass `secondIntroBookingDraft` when applicable
12. Fix isSale detection: `outcome.includes('OTbeat') || outcome === 'Premier' || outcome === 'Elite' || outcome === 'Basic'`
13. Remove `Input` import (no longer needed for commission)

---

## Step 3 — `src/lib/domain/outcomes/applyIntroOutcomeUpdate.ts`

**Current state:** Accepts `commissionAmount?: number` as a param. Has no `secondIntroBookingDraft` support. Does not use `computeCommission`.

- **Changes (minimal, additive only):**  
  
hardcoded `sa_working_shift: 'AM'` needs to either pull from context or be null, and keep the Leads component import even while redirecting the route.

1. Import `computeCommission` from `@/lib/outcomes/commissionRules.ts`
2. Add to `OutcomeUpdateParams`:
  ```typescript
   secondIntroBookingDraft?: { class_start_at: string; coach_name: string };
  ```
3. Add to `OutcomeUpdateResult`:
  ```typescript
   newBookingId?: string;
   newBookingStartAt?: string;
   newBookingCoachName?: string;
  ```
4. Compute commission internally: `const resolvedCommission = computeCommission({ membershipType: params.membershipType ?? null })`. Use this instead of `params.commissionAmount` everywhere in the function. Keep `commissionAmount` in the param interface as optional for backwards compatibility but ignore it — internal computation wins.
5. At the end of the function (after audit log), when `secondIntroBookingDraft` is provided:
  ```typescript
   if (params.secondIntroBookingDraft) {
     const { data: newBooking } = await supabase.from('intros_booked').insert({
       member_name: params.memberName,
       class_date: params.secondIntroBookingDraft.class_start_at.split('T')[0],
       class_start_at: params.secondIntroBookingDraft.class_start_at,
       coach_name: params.secondIntroBookingDraft.coach_name,
       lead_source: params.leadSource || '',
       sa_working_shift: 'AM',
       originating_booking_id: params.bookingId,
       rebooked_from_booking_id: params.bookingId,
       rebook_reason: 'second_intro',
       booking_status_canon: 'ACTIVE',
       booking_type_canon: 'STANDARD',
       questionnaire_status_canon: 'not_sent',
     }).select('id').single();
     if (newBooking) {
       return { success: true, ..., newBookingId: newBooking.id, newBookingStartAt: params.secondIntroBookingDraft.class_start_at, newBookingCoachName: params.secondIntroBookingDraft.coach_name };
     }
   }
  ```

---

## Step 4 — `src/components/dashboard/UnresolvedIntros.tsx`

**Current state:** Title says "Past intros to resolve", has `AlertTriangle` icon in header, amber urgency styling on No Show button border.

**Changes:**

1. Remove `AlertTriangle` from the `CardTitle` line (keep it in the button for "No Show" action — that's functional, not decorative urgency)
2. Change title text from `"Past intros to resolve"` to `"Needs outcome"`
3. Remove `AlertTriangle` from lucide import only if it's no longer used (it IS still used in the No Show button — keep the import)
4. The `SectionHelp` text update: change to `"These are past intros that still need an outcome logged."`
5. Keep the filter chip, card styling, and all logic unchanged

---

## Step 5 — `src/App.tsx`

**Current state:** `/shift-recap` is a full `ProtectedRoute` wrapping `<ShiftRecap />`.

**Changes:**

1. Change the `/shift-recap` route from:
  ```tsx
   <Route path="/shift-recap" element={<ProtectedRoute><ShiftRecap /></ProtectedRoute>} />
  ```
   to:
2. Keep `import ShiftRecap from "./pages/ShiftRecap"` in place to avoid any tree-shaking issues, but it will no longer be rendered
3. Add `/leads` redirect:
  ```tsx
   <Route path="/leads" element={<Navigate to="/pipeline" replace />} />
  ```
   Remove the existing `/leads` route that wraps `<Leads />` with `<ProtectedRoute>`

---

## Step 6 — `src/components/BottomNav.tsx`

**Current state:** 5 primary items + More overflow with Scripts, My Perf, Admin, Config.

**Target:** 3 primary items: My Day, Pipeline, Admin (admin-only). Studio moves to "More" overflow.

**Changes — full rewrite of the items arrays:**

```typescript
const primaryItems = [
  { path: '/my-day', label: 'My Day', icon: Home },
  { path: '/pipeline', label: 'Pipeline', icon: GitBranch },
];

// Admin item shown separately, gated by canAccessAdmin
const adminItem = { path: '/admin', label: 'Admin', icon: Settings };

// Studio goes to overflow
const overflowItems = [
  { path: '/recaps', label: 'Studio', icon: TrendingUp },
];
```

Remove all references to: `FileText` (Recap/ShiftRecap), `Users` (Leads), `MessageSquare` (Scripts), `ClipboardList` (My Perf), `Wrench` (Config/Settings) from the nav arrays. Keep imports only if used elsewhere in the file — otherwise remove them.

On mobile and desktop, primary nav shows: My Day, Pipeline, and Admin (if `canAccessAdmin`). "More" button shows Studio. No badge logic needed on Pipeline (the `/leads` badge moved; simplify or remove).

Remove the `useFollowUpCount` hook call since the Leads badge is gone from the nav.

---

## Step 7 — Admin > Data Tools: Phone Backfill Button

**Location:** `src/pages/Admin.tsx`, inside the `"data"` tab's `<TabsContent value="data">` block. The `IntegrityDashboard` and `VipBulkImport` are already there.

**Changes to `src/pages/Admin.tsx`:**

1. Import a new inline component or add state+handler directly in the file
2. Add a small card in the data tab with a button "Backfill missing phones from email parsing"
3. On click: call `supabase.rpc('backfill_booking_phones')` (this RPC already exists in the database as `backfill_booking_phones(p_days_back int default 365)`)
4. Display result: `"Updated N rows"` using a toast and an inline result state

The `backfill_booking_phones` RPC is already defined in the DB (confirmed in the supabase DB functions). No migration needed.

---

## Pipeline Tab Coverage (Step 6 verification)

The existing Pipeline tabs already cover all required tabs from the spec:

- `today` ✅
- `upcoming` ✅  
- `no_show` ✅ (labeled "No-shows")
- `second_intro` ✅ (labeled "2nd")
- `not_interested` ✅ (labeled "Not Interested")
- `vip_class` ✅ (labeled "VIP")

No pipeline tab changes needed.

---

## Implementation Order

```text
1. CREATE src/lib/outcomes/commissionRules.ts
2. CREATE src/lib/datetime/formatTime.ts
3. CREATE src/lib/canon/canonFallback.ts
4. MODIFY src/lib/domain/outcomes/applyIntroOutcomeUpdate.ts (add secondIntroBookingDraft, internal commission)
5. MODIFY src/components/myday/OutcomeDrawer.tsx (new outcomes, computed commission, 2nd intro flow)
6. MODIFY src/components/dashboard/UnresolvedIntros.tsx (rename title, remove header icon)
7. MODIFY src/App.tsx (redirect /shift-recap and /leads)
8. MODIFY src/components/BottomNav.tsx (3-item nav, Studio to overflow)
9. MODIFY src/pages/Admin.tsx (phone backfill button in data tab)
```

---

## Acceptance Checklist Mapping


| Check                                               | Implementation                                                       |
| --------------------------------------------------- | -------------------------------------------------------------------- |
| Outcome sheet: Premier+OTbeat = $15, no input field | OutcomeDrawer: computed commission via commissionRules.ts            |
| Booked 2nd intro flow                               | OutcomeDrawer: date/time/coach inputs → confirmation line after save |
| "Needs outcome" section, calm styling               | UnresolvedIntros: title change, remove AlertTriangle from header     |
| /shift-recap redirects to /my-day                   | App.tsx: Navigate redirect                                           |
| Bottom nav: exactly My Day, Pipeline, Admin         | BottomNav: rebuild items arrays                                      |
| Studio still accessible                             | BottomNav: Studio in More overflow                                   |
| /leads redirects to /pipeline                       | App.tsx: Navigate redirect                                           |
| Pipeline has all required tabs                      | Already present — no change needed                                   |
| Phone backfill button in Admin Data tab             | Admin.tsx: button calls backfill_booking_phones RPC                  |
| No build errors                                     | ShiftRecap import kept, Leads import kept but route redirected       |
