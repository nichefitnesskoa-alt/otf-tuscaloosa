
# Fix: Commission Calculation Bug, Staff Roles, and Data Corrections

## Issues Identified

### Issue 1: Commission Calculation Bug (Critical)

The commission calculation logic in ShiftRecap.tsx (lines 368-374) has a flaw:

```javascript
// BUGGY CODE:
if (outcomeLower.includes('premier') && outcomeLower.includes('otbeat')) 
  commissionAmount = 15;  // <-- This matches "Premier w/o OTBeat" too!
else if (outcomeLower.includes('premier')) 
  commissionAmount = 7.5;
```

**The Bug**: "Premier w/o OTBeat" contains both "premier" AND "otbeat" (the word "OTBeat" appears in "w/o OTBeat"), so the first condition matches and sets commission to $15 instead of $7.50.

**Fix Required**: Check for "+ OTBeat" explicitly (with the plus sign) instead of just "otbeat".

### Issue 2: Elizabeth and Bre Not Listed as Sales Associates

Currently in `src/types/index.ts`:
- COACHES includes: Bre, Elizabeth, James, Kaitlyn H, Nathan, Natalya
- SALES_ASSOCIATES includes: Bri, Grace, Kailey, Katie, Kayla, Koa, Lauren, Nora, Sophie

Elizabeth and Bre need to be added to SALES_ASSOCIATES so they can be attributed as intro owners for commission.

### Issue 3: Kacie Shatzkamer Attribution Error

Current record shows:
- intro_owner: "Kailey"
- Should be: "Elizabeth"

This requires a database update.

### Issue 4: Wrong Commission Values (Data Fix)

6 records have incorrect commission amounts (showing $15 instead of $7.50):

| Member | Current | Correct |
|--------|---------|---------|
| Mary Waller | $15.00 | $7.50 |
| Lauryn Holzkamp | $15.00 | $7.50 |
| Adeline Harper | $15.00 | $7.50 |
| Anna Livingston | $15.00 | $7.50 |
| Zoe Hall | $15.00 | $7.50 |
| Kacie Shatzkamer | $15.00 | $7.50 |

---

## Technical Implementation

### Fix 1: Commission Calculation Logic

**File:** `src/pages/ShiftRecap.tsx` (lines 366-374)

**Before (buggy):**
```javascript
let commissionAmount = 0;
const outcomeLower = run.outcome.toLowerCase();
if (outcomeLower.includes('premier') && outcomeLower.includes('otbeat')) 
  commissionAmount = 15;
else if (outcomeLower.includes('premier')) 
  commissionAmount = 7.5;
// ... etc
```

**After (fixed):**
```javascript
let commissionAmount = 0;
const outcomeLower = run.outcome.toLowerCase();
// Check for "+ otbeat" explicitly to avoid matching "w/o otbeat"
if (outcomeLower.includes('premier') && outcomeLower.includes('+ otbeat')) 
  commissionAmount = 15;
else if (outcomeLower.includes('premier')) 
  commissionAmount = 7.5;
else if (outcomeLower.includes('elite') && outcomeLower.includes('+ otbeat')) 
  commissionAmount = 12;
else if (outcomeLower.includes('elite')) 
  commissionAmount = 6;
else if (outcomeLower.includes('basic') && outcomeLower.includes('+ otbeat')) 
  commissionAmount = 9;
else if (outcomeLower.includes('basic')) 
  commissionAmount = 3;
```

### Fix 2: Add Elizabeth and Bre to SALES_ASSOCIATES

**File:** `src/types/index.ts` (line 12)

**Before:**
```typescript
export const SALES_ASSOCIATES = ['Bri', 'Grace', 'Kailey', 'Katie', 'Kayla', 'Koa', 'Lauren', 'Nora', 'Sophie'] as const;
```

**After:**
```typescript
export const SALES_ASSOCIATES = ['Bre', 'Bri', 'Elizabeth', 'Grace', 'Kailey', 'Katie', 'Kayla', 'Koa', 'Lauren', 'Nora', 'Sophie'] as const;
```

### Fix 3: Update Kacie Shatzkamer Attribution

**Database Update:**
```sql
UPDATE intros_run 
SET intro_owner = 'Elizabeth' 
WHERE member_name = 'Kacie Shatzkamer';
```

Also update the linked booking:
```sql
UPDATE intros_booked 
SET intro_owner = 'Elizabeth' 
WHERE member_name = 'Kacie Shatzkamer';
```

### Fix 4: Correct Wrong Commission Values

**Database Update:**
```sql
UPDATE intros_run 
SET commission_amount = 7.50 
WHERE result = 'Premier w/o OTBeat' 
  AND commission_amount = 15.00;
```

This will fix all 6 incorrect records in one query.

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/pages/ShiftRecap.tsx` | Fix commission calculation logic (lines 366-374) |
| `src/types/index.ts` | Add Bre and Elizabeth to SALES_ASSOCIATES |
| **Database** | Update Kacie attribution and fix wrong commission values |

---

## Additional Checks

After these fixes, I will also check:
1. FollowupPurchaseEntry.tsx uses COMMISSION_RATES correctly (already uses explicit values)
2. Any other places that calculate commission
3. Verify all metrics display correctly after data fix

---

## Expected Outcomes

After implementation:
- New "Premier w/o OTBeat" submissions will correctly set commission to $7.50
- Elizabeth and Bre will appear in SA dropdowns for intro attribution
- Kacie Shatzkamer will show Elizabeth as intro_owner
- All 6 incorrect records will show $7.50 commission
- Total commission will decrease by $45 (6 × $7.50 difference)
