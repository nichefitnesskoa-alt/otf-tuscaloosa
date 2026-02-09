

# Show Membership Type for All Clients in Pay Period Commission

## Problem

Currently, the Pay Period Commission panel shows membership type only for "outside intro" sales. For intro-based sales, it just shows "Intro" as a badge instead of the actual membership purchased (Premier, Elite, Basic, etc.).

## Solution

Update the data fetching and display to include the `result` field from `intros_run`, which contains the membership type (e.g., "Premier + OTBeat", "Elite w/o OTBeat").

---

## Current vs Proposed Display

**Current:**
```text
Sarah Johnson
Feb 5 · [Intro]                    $15.00
```

**After Fix:**
```text
Sarah Johnson
Feb 5 · Premier + OTBeat           $15.00
```

---

## Technical Changes

### File: `src/components/PayPeriodCommission.tsx`

**1. Update the intros_run query to include `result`:**

```typescript
// Line 86 - Add 'result' to the select
const { data: runs, error: runsError } = await supabase
  .from('intros_run')
  .select('intro_owner, sa_name, commission_amount, run_date, buy_date, created_at, member_name, result')
  .gt('commission_amount', 0);
```

**2. Include membership type in detail object for intro runs:**

```typescript
// Lines 122-127 - Add membershipType from result field
payrollMap[owner].details.push({
  memberName: run.member_name,
  amount: run.commission_amount || 0,
  date: getSaleDate(run.buy_date, run.run_date, null, run.created_at),
  type: 'intro',
  membershipType: run.result, // Add this line
});
```

**3. Update display to always show membership type:**

```typescript
// Line 281-283 - Show membership type for both intro and outside sales
<Badge variant={detail.type === 'intro' ? 'default' : 'secondary'} className="text-[10px] px-1 py-0">
  {detail.membershipType || (detail.type === 'intro' ? 'Intro' : 'Outside')}
</Badge>
```

---

## Result

After this change, each client row will show:
- Member name
- Sale date
- **Membership type** (Premier + OTBeat, Elite w/o OTBeat, etc.)
- Commission amount

This applies to both intro-based sales and outside-intro sales.

