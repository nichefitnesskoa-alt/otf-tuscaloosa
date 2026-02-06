
# Comprehensive Data Flow Fix: Follow-up Purchases, Coach Columns, and Full System Audit

## Executive Summary

This plan addresses four major areas:
1. **New "Mark as Purchased" feature** in Shift Recap for follow-up sales (no extra intro run needed)
2. **Fix Lead Source Analytics and Pipeline Funnel** to use any-run-with-sale logic
3. **Add Coach columns** to Client Journey and Members Who Bought panels
4. **Full system audit** ensuring all data flows correctly across every page

---

## Part 1: New "Mark Follow-up Purchase" Feature in Shift Recap

### Current Problem

When a client (e.g., Zoe Hall) comes in for an intro on Feb 4 with result "Follow-up needed", then returns Feb 6 and purchases a membership, the SA currently has two options:
1. Create ANOTHER intro run entry (confusing, creates duplicate records)
2. Ask Admin to manually update (slow, requires elevated access)

### Proposed Solution

Add a new section in Shift Recap called **"Follow-up Purchases"** that allows SAs to:
1. Select a client who had a previous intro (from a filtered list of "Follow-up needed" / "Booked 2nd intro" clients)
2. Select the membership type they purchased
3. Submit with today's date as the `buy_date`

This will:
- **UPDATE** the existing intro_run record with the new `result` and `buy_date`
- **NOT** create a new intro_run record
- Maintain proper attribution (original intro_owner gets the commission)

### New Component: `FollowupPurchaseEntry.tsx`

```text
+----------------------------------------------------------+
|  Follow-up Purchase                                       |
|  Select a client who came back to buy after their intro   |
+----------------------------------------------------------+
|                                                           |
|  [ Select from follow-up clients... ▼ ]                  |
|     - Shows clients with "Follow-up needed" result        |
|     - Displays: Name, Intro Date, Intro Owner             |
|                                                           |
|  [ Membership Type ▼ ]                                    |
|     Premier + OTBeat ($15)                               |
|     Premier w/o OTBeat ($7.50)                           |
|     Elite + OTBeat ($12)                                 |
|     etc.                                                  |
|                                                           |
|  Purchase Date: [2026-02-06] (defaults to today)         |
|                                                           |
|  ℹ️ Commission ($X) goes to [Intro Owner Name]           |
|                                                           |
+----------------------------------------------------------+
```

### Data Flow for Follow-up Purchase

When submitted:
1. Find the **most recent run** for the selected client with result "Follow-up needed" or "Booked 2nd intro"
2. **UPDATE** that run record:
   - `result` → selected membership type
   - `buy_date` → today's date (shift date)
   - `commission_amount` → calculated from membership type
   - `notes` → append "Follow-up purchase logged by [SA] on [date]"
3. **UPDATE** the linked booking:
   - `booking_status` → "Closed (Purchased)"
   - `closed_at` → now
   - `closed_by` → SA name

### Files to Create/Modify

| File | Action |
|------|--------|
| `src/components/FollowupPurchaseEntry.tsx` | CREATE - New component for follow-up purchases |
| `src/components/FollowupPurchaseSelector.tsx` | CREATE - Selector showing eligible follow-up clients |
| `src/pages/ShiftRecap.tsx` | MODIFY - Add new section for follow-up purchases |
| `src/components/IntroRunEntry.tsx` | MODIFY - Update interface to include new data fields |

---

## Part 2: Fix Lead Source Analytics and Pipeline Funnel

### Current Bug

The Lead Source and Pipeline metrics in `useDashboardMetrics.ts` only check the **first run's result**, ignoring follow-up conversions.

**Lines 348-358 (Lead Source):**
```javascript
const nonNoShowRun = runs.find(r => r.result !== 'No-show');
if (nonNoShowRun) {
  existing.showed++;
  if (isMembershipSaleGlobal(nonNoShowRun.result)) {  // BUG: Only first run
    existing.sold++;
    ...
  }
}
```

### Fix Required

Check if **ANY run** for the booking has a sale result:

```javascript
const nonNoShowRun = runs.find(r => r.result !== 'No-show');
if (nonNoShowRun) {
  existing.showed++;
  // FIX: Check ALL runs for sale result
  const saleRun = runs.find(r => isMembershipSaleGlobal(r.result));
  if (saleRun) {
    existing.sold++;
    existing.revenue += saleRun.commission_amount || 0;
  }
}
```

### Files to Modify

| File | Lines | Change |
|------|-------|--------|
| `src/hooks/useDashboardMetrics.ts` | 348-358 | Fix Lead Source to use any-run-with-sale logic |
| `src/hooks/useDashboardMetrics.ts` | 372-381 | Fix Pipeline to use any-run-with-sale logic |

---

## Part 3: Add Coach Columns

### Current State

Coach information is stored in `intros_booked.coach_name` but not displayed in:
- Client Journey Panel (Admin)
- Client Journey ReadOnly (Studio)
- Membership Purchases Panel (Admin)
- Membership Purchases ReadOnly (Studio)

### Implementation

#### 3.1 Client Journey Panels

Add `coach` field to the ClientBooking interface (already present) and display it in the collapsible row summary.

**Display format:**
```
[Member Name] | 👤 Owner: Grace | 🏋️ Coach: Natalya | 📅 Feb 4
```

#### 3.2 Membership Purchases Panels

Fetch `coach_name` from the linked booking and add a "Coach" column to the table.

### Files to Modify

| File | Change |
|------|--------|
| `src/components/admin/ClientJourneyPanel.tsx` | Add coach display in row summary |
| `src/components/dashboard/ClientJourneyReadOnly.tsx` | Add coach display in row summary |
| `src/components/admin/MembershipPurchasesPanel.tsx` | Fetch coach_name, add Coach column |
| `src/components/dashboard/MembershipPurchasesReadOnly.tsx` | Fetch coach_name, add Coach column |

---

## Part 4: Full System Audit - Data Interconnection Verification

### Page-by-Page Analysis

#### Shift Recap (`/shift-recap`)
| Section | Data Created | Status |
|---------|--------------|--------|
| Intros Booked | `intros_booked` table | Working |
| Intros Run | `intros_run` table | Working |
| Sales Outside | `sales_outside_intro` table | Working |
| **NEW: Follow-up Purchases** | Updates existing `intros_run` | To implement |

#### My Shifts (`/my-shifts`)
| Section | Data Displayed | Status |
|---------|----------------|--------|
| Shift History | User's `shift_recaps` | Working |
| Drill-down | Linked bookings/runs/sales | Working |

#### My Stats / Dashboard (`/dashboard`)
| Section | Data Source | Status |
|---------|-------------|--------|
| Personal Scoreboard | `useDashboardMetrics` → perSA | FIXED (previous update) |
| Individual Activity | `shift_recaps` filtered by user | Working |

#### Studio (`/recaps`)
| Section | Data Source | Status |
|---------|-------------|--------|
| Studio Scoreboard | Aggregated perSA data | Working |
| Pipeline Funnel | `useDashboardMetrics` → pipeline | **NEEDS FIX** |
| Lead Source Analytics | `useDashboardMetrics` → leadSourceMetrics | **NEEDS FIX** |
| Client Pipeline | `ClientJourneyReadOnly` | **NEEDS COACH** |
| Members Who Bought | `MembershipPurchasesReadOnly` | **NEEDS COACH** |
| Top Performers | Leaderboard data | Working |
| Per-SA Table | perSA metrics | Working |
| Booker Stats | bookerStats metrics | Working |

#### Admin (`/admin`)
| Section | Data Source | Status |
|---------|-------------|--------|
| Payroll Export | Commission calculation | Working |
| Pay Period Commission | Date-filtered metrics | Working |
| Coach Performance | Coach stats | FIXED (previous update) |
| Client Journey | `ClientJourneyPanel` | **NEEDS COACH** |
| Members Who Bought | `MembershipPurchasesPanel` | **NEEDS COACH** |
| Shift Recaps Editor | Direct DB editing | Working |
| Data Health | Data integrity checks | Working |

---

## Part 5: Technical Implementation Details

### 5.1 FollowupPurchaseSelector Component

```typescript
interface EligibleFollowup {
  runId: string;
  memberName: string;
  introDate: string;
  introOwner: string;
  linkedBookingId: string | null;
  leadSource: string | null;
}

// Query: Find runs with Follow-up/2nd intro results that don't have a sale
const eligibleClients = runs.filter(r => 
  ['Follow-up needed', 'Booked 2nd intro'].includes(r.result) &&
  !runs.some(other => 
    other.member_name === r.member_name && 
    isMembershipSale(other.result)
  )
);
```

### 5.2 Follow-up Purchase Submission Logic

```typescript
// On submit:
const handleFollowupPurchase = async (
  runId: string, 
  membershipType: string, 
  buyDate: string,
  linkedBookingId: string | null
) => {
  // Calculate commission
  const commission = getCommissionForType(membershipType);
  
  // Update the existing run record
  await supabase
    .from('intros_run')
    .update({
      result: membershipType,
      buy_date: buyDate,
      commission_amount: commission,
      notes: `[Previous: Follow-up needed] Converted on ${buyDate}`,
    })
    .eq('id', runId);
  
  // Close the linked booking if exists
  if (linkedBookingId) {
    await supabase
      .from('intros_booked')
      .update({
        booking_status: 'Closed (Purchased)',
        closed_at: new Date().toISOString(),
        closed_by: currentUserName,
      })
      .eq('id', linkedBookingId);
  }
};
```

### 5.3 Coach Column in Membership Purchases

```typescript
// Add coach_name to the booking fetch
const { data: bookings } = await supabase
  .from('intros_booked')
  .select('id, sa_working_shift, booked_by, lead_source, coach_name');

const bookingMap = new Map(
  (bookings || []).map(b => [b.id, { 
    bookedBy: b.booked_by || b.sa_working_shift,
    leadSource: b.lead_source,
    coach: b.coach_name,  // NEW
  }])
);
```

---

## Expected Outcomes After Implementation

### Follow-up Purchase Flow
- SA can quickly mark a returning client as purchased
- Original intro_owner gets commission credit
- No duplicate run records created
- `buy_date` is set correctly for pay period filtering

### Lead Source Analytics
- "Online Intro Offer" will show Zoe Hall and Adeline Harper as sold
- "Instagram DMs" will show Anna Livingston as sold
- All sources will accurately reflect follow-up conversions

### Pipeline Funnel
- "Sold" count will increase by 3 (Zoe, Adeline, Anna)
- Matches per-SA metrics totals

### Coach Visibility
- Client Journey shows: "Coach: Natalya" for today's sales
- Members Who Bought shows coach in dedicated column

### Consistency Verification
- Pipeline Funnel "Sold" = Sum of Lead Source "Sold"
- Studio Scoreboard sales = Per-SA Table total
- Commission totals match across all views

---

## Files to Create

| File | Purpose |
|------|---------|
| `src/components/FollowupPurchaseEntry.tsx` | Main component for follow-up purchase entry |
| `src/components/FollowupPurchaseSelector.tsx` | Dropdown selector for eligible follow-up clients |

## Files to Modify

| File | Changes |
|------|---------|
| `src/pages/ShiftRecap.tsx` | Add Follow-up Purchases section |
| `src/hooks/useDashboardMetrics.ts` | Fix Lead Source and Pipeline to use any-run-with-sale logic |
| `src/components/admin/ClientJourneyPanel.tsx` | Add coach display in row |
| `src/components/dashboard/ClientJourneyReadOnly.tsx` | Add coach display in row |
| `src/components/admin/MembershipPurchasesPanel.tsx` | Add coach_name fetch and column |
| `src/components/dashboard/MembershipPurchasesReadOnly.tsx` | Add coach_name fetch and column |

---

## Testing Checklist

After implementation:
- [ ] Follow-up purchase updates existing run (not creates new)
- [ ] Lead Source shows correct sold counts (including follow-ups)
- [ ] Pipeline Funnel sold count matches per-SA totals
- [ ] Coach displayed in Client Journey (Admin & Studio)
- [ ] Coach displayed in Members Who Bought (Admin & Studio)
- [ ] Grace shows 2 sales with correct closing rate
- [ ] Kailey shows 2 sales with correct closing rate
- [ ] Commission totals are consistent across all views
