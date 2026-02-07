
# Fix: Duplicate Staff Names and Empty Sales Entry Bug

## Issues Identified

### Issue 1: "ElizabethElizabeth" Bug in Coach/Staff Dropdowns

**Root Cause**: In `src/types/index.ts`, the `ALL_STAFF` array is created by spreading both `COACHES` and `SALES_ASSOCIATES`:

```typescript
export const COACHES = ['Bre', 'Elizabeth', 'James', 'Kaitlyn H', 'Nathan', 'Natalya'] as const;
export const SALES_ASSOCIATES = ['Bre', 'Bri', 'Elizabeth', 'Grace', 'Kailey', 'Katie', 'Kayla', 'Koa', 'Lauren', 'Nora', 'Sophie'] as const;
export const ALL_STAFF = [...COACHES, ...SALES_ASSOCIATES] as const;
```

This creates `ALL_STAFF` with duplicates:
```
['Bre', 'Elizabeth', 'James', 'Kaitlyn H', 'Nathan', 'Natalya', 'Bre', 'Bri', 'Elizabeth', ...]
```

When used in Select dropdowns with `{ALL_STAFF.map(s => <SelectItem key={s} value={s}>`, React warns about duplicate keys and the value gets concatenated when selected.

**Solution**: Deduplicate `ALL_STAFF` when creating it.

---

### Issue 2: Sarah Allen Missing / Blank Sale Entry in GroupMe

**Root Cause**: Looking at the stored GroupMe recap for Bri on 2026-02-06:

```
💵 Outside Sales (2):
1. sophia lange : Premier w/o OTBeat ($7.50)
2. :  ($0.00)    <-- BLANK ENTRY
```

The `sales` array in the form state contained an empty entry that was passed to GroupMe. This happens when a user adds a sale entry but doesn't fill it out before submitting.

**Clarification on Sarah Allen**: Sarah Allen was an intro run from 2026-02-04 (Bri's shift), not the same recap. She appears correctly in the intros_run database. The "blank name with commission" was a separate issue - an empty sale form entry.

**Solution**: Filter out empty sale entries BEFORE passing to GroupMe (in ShiftRecap.tsx), not just during formatting.

---

## Technical Implementation

### Fix 1: Deduplicate ALL_STAFF Array

**File**: `src/types/index.ts`

**Change**: Create a unique array from the combined staff lists

**Before**:
```typescript
export const ALL_STAFF = [...COACHES, ...SALES_ASSOCIATES] as const;
```

**After**:
```typescript
// Deduplicate staff who appear in both COACHES and SALES_ASSOCIATES
const _allStaffSet = [...new Set([...COACHES, ...SALES_ASSOCIATES])];
export const ALL_STAFF = _allStaffSet as unknown as readonly string[];
```

This ensures Elizabeth and Bre only appear once in dropdowns.

---

### Fix 2: Filter Empty Sales Before GroupMe Post

**File**: `src/pages/ShiftRecap.tsx` (around line 585)

**Before**:
```typescript
sales: sales.map(s => ({ 
  memberName: s.memberName, 
  membershipType: s.membershipType, 
  commissionAmount: s.commissionAmount 
})),
```

**After**:
```typescript
// Filter out empty sale entries before sending to GroupMe
sales: sales
  .filter(s => s.memberName && s.memberName.trim())
  .map(s => ({ 
    memberName: s.memberName, 
    membershipType: s.membershipType, 
    commissionAmount: s.commissionAmount 
  })),
```

This prevents empty form entries from appearing in GroupMe posts.

---

## Files to Modify

| File | Change |
|------|--------|
| `src/types/index.ts` | Deduplicate ALL_STAFF array |
| `src/pages/ShiftRecap.tsx` | Filter empty sales before GroupMe post |

---

## Expected Results

After implementation:
- Coach dropdown shows Elizabeth and Bre only once each
- Selecting Elizabeth saves as "Elizabeth" (not "ElizabethElizabeth")
- GroupMe recaps will not include blank sales entries
- Sarah Allen's intro run data is already correctly stored (no action needed)

---

## Testing Checklist

- [ ] Open shift recap form and verify Elizabeth appears once in any staff dropdown
- [ ] Select Elizabeth as a coach - confirm value saves as "Elizabeth"
- [ ] Submit a recap with an empty sale entry - verify GroupMe does not show blank entry
- [ ] Check admin dropdown filters show correct staff list without duplicates
