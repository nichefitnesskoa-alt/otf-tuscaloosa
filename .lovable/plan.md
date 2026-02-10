
# Add Reschedule vs 2nd Intro Choice

## Problem

When you type a client name during booking entry and select an existing client, the app always assumes it's a **reschedule** and opens the reschedule dialog. But sometimes the client needs a **2nd intro** -- a completely new booking linked to the original -- not just a date change on the existing one.

## Solution

Replace the automatic reschedule behavior with a **choice dialog** that asks: "Is this a Reschedule or a 2nd Intro?" Then proceed accordingly.

---

## How It Works

```text
Type client name → Match found → Click existing client
                                        │
                                  ┌─────▼──────┐
                                  │ What action?│
                                  └──┬──────┬───┘
                                     │      │
                              Reschedule  2nd Intro
                                     │      │
                              Update the   Create NEW
                              existing     booking with
                              booking's    originating_
                              date/time    booking_id
                                           pointing to
                                           original
```

## Changes

### 1. New Component: `src/components/ClientActionDialog.tsx`

A small dialog that appears when you select an existing client. It shows:
- Client name and current booking info
- Two buttons: **Reschedule** and **Book 2nd Intro**

Selecting **Reschedule** opens the existing `RescheduleClientDialog`.

Selecting **Book 2nd Intro** pre-fills the booking entry form with:
- The client's name (auto-filled)
- Lead source carried over from original
- `originating_booking_id` set to the original booking's ID
- Dismisses the duplicate warning since this is intentional

### 2. Modify: `src/components/IntroBookingEntry.tsx`

- Replace the direct `RescheduleClientDialog` opening with the new `ClientActionDialog`
- Add `originating_booking_id` to the `IntroBookingData` interface so the shift recap submission can link them
- When "2nd Intro" is chosen, populate the form fields and set `originating_booking_id`

Updated interface:
```typescript
export interface IntroBookingData {
  id: string;
  memberName: string;
  introDate: string;
  introTime: string;
  leadSource: string;
  notes: string;
  originatingBookingId?: string;  // NEW - links 2nd intros to original
}
```

Updated handler flow:
```typescript
const handleSelectExisting = (client: PotentialMatch) => {
  setSelectedClient(client);
  setShowActionDialog(true);  // Show choice dialog instead of reschedule
};

const handleChooseReschedule = () => {
  setShowActionDialog(false);
  setShowRescheduleDialog(true);
};

const handleChoose2ndIntro = () => {
  setShowActionDialog(false);
  setDismissedWarning(true);
  onUpdate(index, {
    memberName: selectedClient.member_name,
    leadSource: selectedClient.lead_source,
    notes: `2nd intro - Original booking: ${selectedClient.class_date}`,
    originatingBookingId: selectedClient.id,
  });
};
```

### 3. Modify: `src/pages/ShiftRecap.tsx`

When submitting bookings, pass through the `originating_booking_id` field so new 2nd-intro bookings are properly linked to their original booking in the database.

Find the booking submission section and add:
```typescript
originating_booking_id: booking.originatingBookingId || null,
```

---

## Technical Details

### Files to Create
| File | Purpose |
|------|---------|
| `src/components/ClientActionDialog.tsx` | Choice dialog: Reschedule vs 2nd Intro |

### Files to Modify
| File | Change |
|------|--------|
| `src/components/IntroBookingEntry.tsx` | Add action choice flow, add `originatingBookingId` to interface |
| `src/pages/ShiftRecap.tsx` | Pass `originating_booking_id` when inserting bookings |

### Database
No schema changes needed -- `intros_booked` already has an `originating_booking_id` column.
