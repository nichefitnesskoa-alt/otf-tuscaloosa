

## Plan: Show Session Type on VIP Scheduler Cards

### Problem
The VIP Scheduler cards in Pipeline don't show which class type was chosen (Social Group, Business — Staff Only, Business — Staff + Customers, Business — Staff + OTF Members). This info exists in `vip_sessions.session_type` and `vip_sessions.business_sub_type` but isn't fetched or displayed.

### Change

**File: `src/features/pipeline/components/VipSchedulerTab.tsx`**

1. **Add `session_type` and `business_sub_type` to the `VipSession` interface** (both `string | null`)

2. **Add a helper function** that maps the stored values to a readable label:
   - `exclusive` → "Social Group / Organization"
   - `business_staff` + `staff_only` → "Business — Staff Only"
   - `business_customers` + `staff_customers` → "Business — Staff + Customers"
   - `open` + `staff_members` → "Business — Staff + OTF Members"
   - `null`/missing → no badge shown

3. **Display a small badge** on each reserved session card, right next to or below the existing `StatusBadge`. Uses a muted outline badge with the readable label. Only shows when `session_type` is set.

Since the query already does `select('*')`, both columns are already fetched — just not typed or displayed. No query changes needed.

### No other files change
Display-only addition to one component.

