
# Fix OTBeat Count in Members Who Bought Section

## Problem
The "+ OTBeat" count is showing 7 instead of 2 because the current logic checks for `includes('otbeat')` which matches BOTH:
- "Premier + OTBeat" (should count)
- "Premier w/o OTBeat" (should NOT count)

## Solution
Change the filter to specifically check for `+ otbeat` (with the plus sign) to only count memberships that include an OTBeat purchase.

## File to Modify
**src/components/admin/MembershipPurchasesPanel.tsx**

### Change (lines 183-185)
From:
```typescript
const withOtbeat = purchases.filter(p => 
  p.membership_type.toLowerCase().includes('otbeat')
).length;
```

To:
```typescript
const withOtbeat = purchases.filter(p => 
  p.membership_type.toLowerCase().includes('+ otbeat')
).length;
```

## Expected Result
The "+ OTBeat" stat will correctly show 2 out of 7 sales (only those with the `+ OTBeat` suffix).
