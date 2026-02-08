
# Lead Source Renaming and Client Deduplication Fix

## Overview

This plan addresses three main areas:
1. Rename and reorganize lead source options across the application
2. Update existing database records to use the new lead source names
3. Fix the duplicate client issue when booking 2nd intros
4. Alphabetize the bookings list in the "Select from Booked Intros" selector

---

## Part 1: Lead Source Changes

### Changes to Make

| Current Name | New Name |
|--------------|----------|
| Referral | Member Referral |
| Booked person brought them (Instagram) | Instagram DMs (Friend) |
| B2C Event | Event |
| B2B Partnership | Business Partnership Referral |
| Lead Management Call / Text | **REMOVE** |
| Lead Management Web Lead Call | **REMOVE** |
| Member brought friend | **REMOVE** |
| *(new)* | Lead Management |
| *(new)* | Lead Management (Friend) |

### New Alphabetized Lead Sources List

```text
1. Business Partnership Referral
2. Event
3. Instagram DMs
4. Instagram DMs (Friend)
5. Lead Management
6. Lead Management (Friend)
7. Member Referral
8. My Personal Friend I Invited
9. Online Intro Offer (self-booked)
10. Source Not Found
11. VIP Class
```

### Files to Update

| File | Changes |
|------|---------|
| `src/types/index.ts` | Update main `LEAD_SOURCES` constant |
| `src/components/IntroBookingEntry.tsx` | Update local `LEAD_SOURCES` array |
| `src/components/IntroRunEntry.tsx` | Update local `LEAD_SOURCES` array |

Note: `SaleEntry.tsx` uses a different set of lead sources (Winback, Upgrade, Walk in, Referral) specifically for "Outside Intro" sales - this will also be updated to use "Member Referral" instead of "Referral".

---

## Part 2: Database Migration

### Update Existing Records

A database migration will update all existing lead_source values in both `intros_booked` and `intros_run` tables:

```sql
-- Rename lead sources in intros_booked
UPDATE intros_booked SET lead_source = 'Member Referral' WHERE lead_source = 'Referral';
UPDATE intros_booked SET lead_source = 'Lead Management' WHERE lead_source = 'Lead Management Call / Text';
UPDATE intros_booked SET lead_source = 'Lead Management' WHERE lead_source = 'Lead Management Web Lead Call';

-- Rename lead sources in intros_run
UPDATE intros_run SET lead_source = 'Member Referral' WHERE lead_source = 'Referral';
UPDATE intros_run SET lead_source = 'Lead Management' WHERE lead_source = 'Lead Management Call / Text';
UPDATE intros_run SET lead_source = 'Lead Management' WHERE lead_source = 'Lead Management Web Lead Call';

-- Rename lead sources in sales_outside_intro
UPDATE sales_outside_intro SET lead_source = 'Member Referral' WHERE lead_source = 'Referral';
```

---

## Part 3: Alphabetize Booked Intros Selector

### Current Behavior
Bookings are sorted by `created_at` descending (newest first).

### New Behavior
Bookings will be sorted alphabetically by `member_name` (A-Z).

### File to Update
`src/components/BookedIntroSelector.tsx` - modify the `filteredBookings` memo to sort alphabetically:

```typescript
const filteredBookings = useMemo(() => {
  // First filter out closed/deleted bookings
  const activeBookings = bookings.filter(b => {
    const status = (b.booking_status || '').toUpperCase();
    return !EXCLUDED_STATUSES.some(s => status.includes(s.toUpperCase()));
  });
  
  // Apply search filter
  const searched = searchQuery.trim()
    ? activeBookings.filter(b => b.member_name.toLowerCase().includes(searchQuery.toLowerCase()))
    : activeBookings;
  
  // Sort alphabetically by member name
  return searched.sort((a, b) => 
    a.member_name.toLowerCase().localeCompare(b.member_name.toLowerCase())
  );
}, [bookings, searchQuery]);
```

---

## Part 4: Fix Duplicate Client Issue (2nd Intro Booking)

### Current Problem
When an intro run is marked as "Booked 2nd intro", the system creates a **new booking record** for that client. This results in the same client appearing twice in the bookings list - once for their original intro and once for the 2nd intro.

### Desired Behavior
When a 2nd intro is scheduled, the system should:
1. **Update the existing booking** with the new scheduled date/time
2. Keep the client as a single record
3. Track the 2nd intro internally via status or notes

### Technical Solution

In `src/pages/ShiftRecap.tsx`, change the "Booked 2nd intro" logic from:
- **Current**: Create new `intros_booked` record with `lead_source = '2nd Class Intro (staff booked)'`

To:
- **New**: Update the linked booking record with:
  - New `class_date` and `intro_time` 
  - Set `booking_status` to '2nd Intro Scheduled'
  - Add note indicating it's a 2nd visit
  - Keep `intro_owner` locked from the first run

### Code Changes

```typescript
// BEFORE: Create new booking for 2nd intro
if (run.outcome === 'Booked 2nd intro') {
  await supabase.from('intros_booked').insert({...});
}

// AFTER: Update existing booking instead
if (run.outcome === 'Booked 2nd intro' && linkedBookingId) {
  await supabase.from('intros_booked')
    .update({
      class_date: run.secondIntroDate,
      intro_time: run.secondIntroTime || null,
      booking_status: '2nd Intro Scheduled',
      fitness_goal: `2nd intro scheduled - Intro owner: ${introOwner}`,
      last_edited_at: new Date().toISOString(),
      last_edited_by: user?.name || 'System',
      edit_reason: 'Rescheduled for 2nd intro',
    })
    .eq('id', linkedBookingId);
}
```

---

## Summary of Files to Modify

| File | Changes |
|------|---------|
| `src/types/index.ts` | Update and alphabetize `LEAD_SOURCES` constant |
| `src/components/IntroBookingEntry.tsx` | Update local `LEAD_SOURCES` array |
| `src/components/IntroRunEntry.tsx` | Update local `LEAD_SOURCES` array |
| `src/components/SaleEntry.tsx` | Update "Referral" to "Member Referral" |
| `src/components/BookedIntroSelector.tsx` | Add alphabetical sorting |
| `src/pages/ShiftRecap.tsx` | Change 2nd intro logic to update instead of create |
| **Database Migration** | Update existing lead_source values |

---

## Testing Checklist

- [ ] Verify lead source dropdowns show new names in alphabetical order
- [ ] Confirm "Booked person brought them" options are removed
- [ ] Confirm "Member brought friend" is removed
- [ ] Check existing database records were migrated to new names
- [ ] Test "Select from Booked Intros" shows clients A-Z
- [ ] Submit a "Booked 2nd intro" outcome and verify no duplicate client is created
- [ ] Find Duplicates created and update and verify the original booking is updated with new date instead
