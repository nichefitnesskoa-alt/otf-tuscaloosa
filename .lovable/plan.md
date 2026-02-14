

## AMC Auto-Increment: Follow-up Fixes

After reviewing all sale paths in the codebase, there are **3 places where sales are recorded but AMC is NOT incremented**, plus a display bug on the Studio AMC card.

---

### Fix 1: Follow-up Purchase Entry (biggest gap)

**File:** `src/components/FollowupPurchaseEntry.tsx`

When a follow-up purchase is logged via Shift Recap, the `intros_run` record is updated with the sale result and `buy_date`, but `incrementAmcOnSale` is never called. This is why Parthkumar Modi, Sunayana Chejara, and Grace Forman were missing from the AMC log.

**Change:** Import `incrementAmcOnSale` and call it in `handleSubmit` after the successful run update, passing `client.memberName`, `membershipType`, and `staffName`.

---

### Fix 2: Admin "Mark as Purchased" in Client Journey Panel

**File:** `src/components/admin/ClientJourneyPanel.tsx`

The Admin Client Journey panel has a "Mark as Purchased" dialog that creates a `sales_outside_intro` record and closes the booking. It does not increment AMC.

**Change:** Import `incrementAmcOnSale` and call it after the successful sale insert, passing the member name, membership type, and the admin user's name.

---

### Fix 3: Studio AMC Tracker display bug

**File:** `src/components/dashboard/AmcTracker.tsx`

The Studio AMC card calculates `pendingChurn` by looking at all `churn_log` entries within the current month. But churn entries that have already been processed into `amc_log` (effective date in the past) are already reflected in the current AMC value. Subtracting them again double-counts the churn, making the "Projected" number too low.

**Change:** Filter `pendingChurn` to only include churn entries with `effective_date > today` (future churn that hasn't been applied yet), matching the logic already used in the Admin AMC form.

---

### Summary of files to change

| File | Change |
|---|---|
| `src/components/FollowupPurchaseEntry.tsx` | Add `incrementAmcOnSale` call on purchase |
| `src/components/admin/ClientJourneyPanel.tsx` | Add `incrementAmcOnSale` call on "Mark as Purchased" |
| `src/components/dashboard/AmcTracker.tsx` | Fix pending churn filter to future-only |

No database changes, no new files, no changes to existing AMC logic in `amc-auto.ts`.

