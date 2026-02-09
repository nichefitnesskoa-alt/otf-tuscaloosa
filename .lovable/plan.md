

# Capture Coach for Intros Run When Booking Has No Coach

## Problem

When a booking is created, the coach is often unknown and set to `TBD`. Currently, when a user selects one of these bookings from the "Select Booked" list to log an intro run, there's no prompt to capture the coach information. The coach field only appears for manual entries, not for bookings selected from the list.

This means intro runs linked to bookings with `coach_name: 'TBD'` end up with no coach attribution.

## Solution

Update the `IntroRunEntry` component to:
1. Pass the coach name from the selected booking to the intro run form
2. Display a coach selector when the selected booking has `coach_name` as `TBD`, empty, or null
3. Always show the coach info when it's already known (read-only display)

---

## Data Flow

```text
BookedIntroSelector → onSelect(booking) → IntroRunEntry.handleSelectBookedIntro
                                              ↓
                                     Check if coach_name is 'TBD'/empty
                                              ↓
                               YES: Show coach selector (required)
                               NO: Display coach name (read-only)
```

---

## Technical Changes

### 1. Update `BookedIntroSelector.tsx`

Ensure the `coach_name` field is included in the `onSelect` callback.

**Current interface (line 27-39):**
The `BookedIntro` interface already includes `coach_name`, and the `onSelect` prop passes the full booking object.

**However**, the parent component's `handleSelectBookedIntro` function (in `IntroRunEntry`) doesn't extract the coach name.

---

### 2. Update `IntroRunEntry.tsx`

#### A. Update `handleSelectBookedIntro` to pass coach name (line 91-107)

```typescript
const handleSelectBookedIntro = (booking: {
  id: string;
  booking_id: string | null;
  member_name: string;
  lead_source: string;
  sa_working_shift: string;
  intro_owner: string | null;
  coach_name: string;  // ADD THIS
}) => {
  onUpdate(index, {
    linkedBookingId: booking.id,
    memberName: booking.member_name,
    leadSource: booking.lead_source,
    bookedBy: booking.sa_working_shift,
    originatingBookingId: booking.booking_id || undefined,
    coachName: booking.coach_name === 'TBD' ? '' : booking.coach_name, // ADD THIS
  });
};
```

#### B. Add state to track if selected booking needs coach (around line 76)

```typescript
const [selectedBookingNeedsCoach, setSelectedBookingNeedsCoach] = useState(false);

// Update the select handler to also check if coach is needed
const handleSelectBookedIntro = (booking: {...}) => {
  const needsCoach = !booking.coach_name || booking.coach_name === 'TBD';
  setSelectedBookingNeedsCoach(needsCoach);
  
  onUpdate(index, {
    linkedBookingId: booking.id,
    memberName: booking.member_name,
    leadSource: booking.lead_source,
    bookedBy: booking.sa_working_shift,
    originatingBookingId: booking.booking_id || undefined,
    coachName: needsCoach ? '' : booking.coach_name,
  });
};
```

#### C. Show coach selector when selected booking lacks coach info (after line 209)

Add a new section that appears when `entryMode === 'select'` and the selected booking has `TBD` coach:

```typescript
{/* Coach (when selected booking doesn't have one) */}
{entryMode === 'select' && selectedBookingNeedsCoach && (
  <div className="p-2 bg-warning/10 border border-warning/30 rounded-lg">
    <Label className="text-xs font-medium">Coach for this intro *</Label>
    <p className="text-xs text-muted-foreground mb-2">
      This booking doesn't have a coach assigned. Please select who coached the intro.
    </p>
    <Select
      value={intro.coachName || ''}
      onValueChange={(v) => onUpdate(index, { coachName: v })}
    >
      <SelectTrigger className="mt-1">
        <SelectValue placeholder="Select coach..." />
      </SelectTrigger>
      <SelectContent>
        {COACHES.map((coach) => (
          <SelectItem key={coach} value={coach}>{coach}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  </div>
)}

{/* Display coach when already known (read-only) */}
{entryMode === 'select' && !selectedBookingNeedsCoach && intro.coachName && (
  <div className="flex items-center gap-2 p-2 bg-muted/50 rounded">
    <span className="text-xs text-muted-foreground">Coach:</span>
    <Badge variant="secondary">{intro.coachName}</Badge>
  </div>
)}
```

---

### 3. Update `ShiftRecap.tsx` Submission Logic

When saving the intro run, also update the linked booking's coach_name if it was TBD:

```typescript
// After inserting the intro run (around line 396-412)
// If the booking had TBD coach, update it with the newly entered coach
if (linkedBookingId && run.coachName) {
  const { data: linkedBooking } = await supabase
    .from('intros_booked')
    .select('coach_name')
    .eq('id', linkedBookingId)
    .maybeSingle();
    
  if (linkedBooking?.coach_name === 'TBD') {
    await supabase
      .from('intros_booked')
      .update({
        coach_name: run.coachName,
        last_edited_at: new Date().toISOString(),
        last_edited_by: user?.name || 'System',
        edit_reason: 'Coach added when intro was run',
      })
      .eq('id', linkedBookingId);
  }
}
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/IntroRunEntry.tsx` | Add coach selector when selected booking has TBD coach |
| `src/pages/ShiftRecap.tsx` | Update linked booking's coach when intro is run |

---

## UI Behavior

### Before
- User selects "Sarah Johnson" from booked intros (has `coach_name: 'TBD'`)
- No coach field is shown
- Intro run is saved with no coach attribution

### After
- User selects "Sarah Johnson" from booked intros (has `coach_name: 'TBD'`)
- Warning-styled coach selector appears: "This booking doesn't have a coach assigned. Please select who coached the intro."
- User selects the coach
- Intro run is saved with coach attribution
- Original booking is also updated with the coach name

---

## Summary

This change ensures that coach attribution is captured at the point of logging an intro run when it wasn't known at booking time, improving data quality for coach performance tracking.

