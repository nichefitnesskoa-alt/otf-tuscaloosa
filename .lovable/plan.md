

# Fix: Filter Lead Measures to Real Staff Only

## Problem

The `useLeadMeasures` hook aggregates metrics by whatever name string appears in database fields like `sa_working_shift`, `booked_by`, `intro_owner`, `staff_name`, `created_by`, and `performed_by`. Values like "AM shift", "Admin", "Koa" (wait — Koa IS in `SALES_ASSOCIATES`), and "Online" are shift-type labels or system values that leak into the SA map because there's no filter against the known staff list.

## Fix

In `src/hooks/useLeadMeasures.ts`, import `ALL_STAFF` from `@/types` and add a validation check inside the `ensure()` function so that only names matching a real staff member get tracked. This single change filters out "AM shift", "Admin", "Online", and any other non-person values at the source.

Additionally, the attribution logic on line 79 currently falls back through `intro_owner → sa_working_shift → booked_by`. The `sa_working_shift` field often contains shift labels like "AM shift" rather than a person's name. The fallback chain should be changed to `booked_by → intro_owner` only — both of which are actual person names. Same filtering applies to `staff_name` from shift recaps (which is always a real person, but the `ALL_STAFF` check covers it anyway).

### Changes to `src/hooks/useLeadMeasures.ts`

1. **Import `ALL_STAFF`** from `@/types`
2. **Update `ensure()`** to reject names not in `ALL_STAFF`: `if (!name || !ALL_STAFF.includes(name)) return;`
3. **Fix attribution fallback** on line 79: change from `b.intro_owner || b.sa_working_shift || b.booked_by` to `b.booked_by || b.intro_owner` — drop `sa_working_shift` since it holds shift labels, not people
4. **Return early** in speed-to-lead and other loops when performer is not in `ALL_STAFF`

No other files need changes. The `LeadMeasuresTable` component just renders whatever data it receives.

## Result

Only rows for actual staff members (Bre, Bri, Elizabeth, Grace, Kailey, Katie, Kayla, Koa, Lauren, Nora, Sophie, James, Kaitlyn H, Nathan, Natalya) will appear. "AM shift", "Admin", "Online", and any other non-person values will be excluded.

