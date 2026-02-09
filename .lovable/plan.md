
# Sync Admin Changes to Studio + Add Lead Source Features

## Overview

This plan addresses multiple requests:
1. **Studio Members Who Bought**: Add lead source column
2. **Studio Client Pipeline**: Sync with Admin's no-show/date rules (local date fix)
3. **Admin Pay Period**: Add lead source, coach, and booked by to sale details
4. **Lead Source Tab/Filter**: Add to both Admin and Studio Client Journey views
5. **Establish pattern**: Changes in Admin should reflect in Studio read-only versions

---

## Changes Summary

| Component | Change |
|-----------|--------|
| `MembershipPurchasesReadOnly.tsx` (Studio) | Add Lead Source column |
| `ClientJourneyReadOnly.tsx` (Studio) | Fix local date logic for no-shows, add Lead Source tab |
| `ClientJourneyPanel.tsx` (Admin) | Add Lead Source tab |
| `PayPeriodCommission.tsx` (Admin) | Add lead source, coach, booked by to sale details |

---

## Technical Changes

### 1. `src/components/dashboard/MembershipPurchasesReadOnly.tsx`

**Add Lead Source column to the table**

The data is already being fetched (`lead_source` is in the interface), just not displayed.

- Add `<TableHead>` for "Lead Source"
- Add `<TableCell>` showing `purchase.lead_source`
- Position after "Ran By" column

```typescript
// Table header (around line 267):
<TableHead>Lead Source</TableHead>

// Table cell (around line 291):
<TableCell className="text-xs">
  {purchase.lead_source || <span className="text-muted-foreground">—</span>}
</TableCell>
```

---

### 2. `src/components/dashboard/ClientJourneyReadOnly.tsx`

**A. Fix local date logic for no-show detection (lines 182-211)**

The Studio version still uses `toISOString().split('T')[0]` which causes UTC issues. Need to add the same `getLocalDateString` helper and update the date comparison functions.

```typescript
// Add helper function (after line 180):
const getLocalDateString = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Update isBookingPast (lines 182-193):
const isBookingPast = (booking: ClientBooking): boolean => {
  const now = new Date();
  const today = getLocalDateString(now); // Changed from toISOString()
  // ... rest of logic
};

// Update isBookingToday (lines 195-198):
const isBookingToday = (booking: ClientBooking): boolean => {
  const today = getLocalDateString(new Date()); // Changed
  return booking.class_date === today;
};

// Update isBookingUpcoming (lines 200-211):
const isBookingUpcoming = (booking: ClientBooking): boolean => {
  const now = new Date();
  const today = getLocalDateString(now); // Changed
  // ... rest of logic
};
```

**B. Add Lead Source tab**

Add a new tab type and filter for grouping/filtering clients by lead source.

- Add `'by_lead_source'` to JourneyTab type
- Add tab trigger with count
- Add filter logic to show clients grouped by lead source
- Add a lead source filter dropdown when this tab is active

```typescript
// Update JourneyTab type (line 35):
type JourneyTab = 'all' | 'upcoming' | 'today' | 'no_show' | 'missed_guest' | 'second_intro' | 'not_interested' | 'by_lead_source';

// Add state for lead source filter:
const [selectedLeadSource, setSelectedLeadSource] = useState<string | null>(null);

// Add lead source options derived from data:
const leadSourceOptions = useMemo(() => {
  const sources = new Set<string>();
  journeys.forEach(j => {
    j.bookings.forEach(b => {
      if (b.lead_source) sources.add(b.lead_source);
    });
  });
  return Array.from(sources).sort();
}, [journeys]);

// Add tab trigger in TabsList (around line 460):
<TabsTrigger value="by_lead_source" className="flex-1 min-w-[60px] gap-1 text-xs">
  <Filter className="w-3 h-3" />
  By Source
</TabsTrigger>

// Add filter dropdown when by_lead_source tab is active
// Add filtering logic in filterJourneysByTab
```

---

### 3. `src/components/admin/ClientJourneyPanel.tsx`

**Add Lead Source tab**

Mirror the same Lead Source tab functionality from the Studio version, but keep editing capabilities.

- Add `'by_lead_source'` to JourneyTab type (line 75)
- Add state for lead source filter
- Compute lead source options from data
- Add tab trigger
- Add filter dropdown when active
- Add filter logic

```typescript
// Update JourneyTab type (line 75):
type JourneyTab = 'all' | 'upcoming' | 'today' | 'completed' | 'no_show' | 'missed_guest' | 'second_intro' | 'not_interested' | 'by_lead_source';

// Add state (around line 186):
const [selectedLeadSource, setSelectedLeadSource] = useState<string | null>(null);

// Add leadSourceOptions memo (around line 600):
const leadSourceOptions = useMemo(() => {
  const sources = new Set<string>();
  journeys.forEach(j => {
    j.bookings.forEach(b => {
      if (b.lead_source) sources.add(b.lead_source);
    });
  });
  return Array.from(sources).sort();
}, [journeys]);

// Add tab count (in tabCounts memo):
by_lead_source: selectedLeadSource ? journeys.filter(j => 
  j.bookings.some(b => b.lead_source === selectedLeadSource)
).length : journeys.length,

// Add tab trigger after 'not_interested' (around line 1420)
// Add filter dropdown when active
// Update filterJourneysByTab for 'by_lead_source' case
```

---

### 4. `src/components/PayPeriodCommission.tsx`

**Add lead source, coach, and booked by to sale details**

Expand the `SaleDetail` interface and data fetching to include these fields.

**A. Update SaleDetail interface (line 39-45)**

```typescript
interface SaleDetail {
  memberName: string;
  amount: number;
  date: string;
  type: 'intro' | 'outside';
  membershipType?: string;
  leadSource?: string;    // NEW
  coach?: string;         // NEW
  bookedBy?: string;      // NEW
}
```

**B. Update data fetching (around line 120)**

Fetch linked booking data to get coach and booked_by:

```typescript
// Add to intros_run select:
.select('..., linked_intro_booked_id, lead_source')

// Fetch bookings for coach/booked_by lookup:
const { data: allBookings } = await supabase
  .from('intros_booked')
  .select('id, coach_name, booked_by, sa_working_shift');

// Create lookup map:
const bookingMap = new Map(
  (allBookings || []).map(b => [b.id, {
    coach: b.coach_name,
    bookedBy: b.booked_by || b.sa_working_shift
  }])
);
```

**C. Update run processing to include new fields (around line 182-196)**

```typescript
const bookingInfo = run.linked_intro_booked_id ? bookingMap.get(run.linked_intro_booked_id) : null;

payrollMap[owner].details.push({
  memberName: run.member_name,
  amount: run.commission_amount || 0,
  date: getSaleDate(run.buy_date, run.run_date, null, run.created_at),
  type: 'intro',
  membershipType: run.result,
  leadSource: run.lead_source || null,      // NEW
  coach: bookingInfo?.coach || null,         // NEW
  bookedBy: bookingInfo?.bookedBy || null,   // NEW
});
```

**D. Update sales processing (around line 199-213)**

```typescript
payrollMap[owner].details.push({
  memberName: sale.member_name,
  amount: sale.commission_amount || 0,
  date: getSaleDate(null, null, sale.date_closed, sale.created_at),
  type: 'outside',
  membershipType: sale.membership_type,
  leadSource: sale.lead_source || null,  // NEW
  coach: null,                           // Outside sales don't have coach
  bookedBy: null,                        // Outside sales don't have booked_by
});
```

**E. Update detail rendering (around line 392-410)**

```typescript
<div className="flex items-center justify-between p-2 bg-background rounded border text-sm">
  <div>
    <p className="font-medium">{detail.memberName}</p>
    <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
      <span>{format(parseLocalDate(detail.date), 'MMM d')}</span>
      <Badge variant={detail.type === 'intro' ? 'default' : 'secondary'} className="text-[10px] px-1 py-0">
        {detail.membershipType || (detail.type === 'intro' ? 'Intro' : 'Outside')}
      </Badge>
      {detail.leadSource && (
        <span>📍 {detail.leadSource}</span>
      )}
      {detail.coach && (
        <span>🏋️ {detail.coach}</span>
      )}
      {detail.bookedBy && (
        <span>📅 {detail.bookedBy}</span>
      )}
    </div>
  </div>
  <p className="font-medium text-success">${detail.amount.toFixed(2)}</p>
</div>
```

---

## UI Mockups

### Members Who Bought (Studio) - After

```text
┌─────────────────────────────────────────────────────────────────────────┐
│ Member       │ Date    │ Type          │ Ran By   │ Lead Source   │ Coach│
├──────────────┼─────────┼───────────────┼──────────┼───────────────┼──────┤
│ John Smith   │ Feb 8   │ Premier+      │ Lauren   │ Member Ref    │ Bre  │
│ Jane Doe     │ Feb 7   │ Elite         │ Bri      │ VIP Class     │ Kait │
└──────────────┴─────────┴───────────────┴──────────┴───────────────┴──────┘
```

### Client Journey - Lead Source Tab

```text
┌─────────────────────────────────────────────────────────────────────────┐
│ Client Pipeline                                                    [↻]  │
├─────────────────────────────────────────────────────────────────────────┤
│ [Search clients...]                                                     │
├─────────────────────────────────────────────────────────────────────────┤
│ All │ Upcoming │ Today │ No-shows │ Missed │ 2nd │ Not Int │ By Source │
│                                                              ▼          │
│                                                    [Select Lead Source] │
│                                                    ┌───────────────────┐│
│                                                    │ All Sources       ││
│                                                    │ Member Referral   ││
│                                                    │ VIP Class         ││
│                                                    │ Lead Management   ││
│                                                    └───────────────────┘│
├─────────────────────────────────────────────────────────────────────────┤
│ [Client list filtered by selected lead source]                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Pay Period Commission - Sale Details (After)

```text
┌─────────────────────────────────────────────────────────────────────────┐
│ ▶ Lauren                                          $45.00                │
│   └─┬──────────────────────────────────────────────────────────────────┤
│     │ John Smith                                           $15.00      │
│     │ Feb 8 │ Premier+ │ 📍 Member Ref │ 🏋️ Bre │ 📅 Grace            │
│     ├──────────────────────────────────────────────────────────────────┤
│     │ Jane Doe                                             $12.00      │
│     │ Feb 7 │ Elite    │ 📍 VIP Class  │ 🏋️ Natalya │ 📅 Katie        │
└─────┴──────────────────────────────────────────────────────────────────┘
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/dashboard/MembershipPurchasesReadOnly.tsx` | Add Lead Source column |
| `src/components/dashboard/ClientJourneyReadOnly.tsx` | Fix local date, add Lead Source tab |
| `src/components/admin/ClientJourneyPanel.tsx` | Add Lead Source tab |
| `src/components/PayPeriodCommission.tsx` | Add lead source, coach, booked by to details |

---

## Summary

This plan ensures:
- Studio "Members Who Bought" shows lead source
- Studio "Client Pipeline" uses correct local date logic (matching Admin fix)
- Both Admin and Studio have a "By Lead Source" tab for filtering/grouping clients
- Admin Pay Period Commission shows full attribution (lead source, coach, booked by) for each sale
- Pattern established: Admin changes should be mirrored to Studio read-only versions
