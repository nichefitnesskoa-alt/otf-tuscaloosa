

# Duplicate Client Detection Alert for Intro Bookings

## Overview

When a Sales Associate enters a member name while booking an intro, the system will check for potential matches in the existing database. If a potential duplicate is found, an alert popup will appear showing the existing client(s) and offering options to:
1. Update the existing client's account (reschedule)
2. Proceed with creating a new booking anyway
3. Cancel and start over

---

## User Experience

### Trigger
When the user types a member name in the "Intros Booked" section and blurs out of the field (or after a 500ms debounce while typing), the system searches for similar names.

### Matching Logic
- **Exact match**: Same name (case-insensitive, trimmed)
- **Fuzzy match**: Similar names using a simple algorithm (e.g., "John Smith" vs "Jon Smith" or "John Smyth")
- **Partial match**: First name OR last name matches

### Alert Popup Content
```text
┌─────────────────────────────────────────────────────────┐
│  ⚠️ Potential Duplicate Found                          │
├─────────────────────────────────────────────────────────┤
│  "Sarah Johnson" may already exist in the system:      │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │ Sarah Johnson                                    │   │
│  │ 📅 Booked: 2026-02-05 | Status: Active          │   │
│  │ 📍 Lead Source: Instagram DMs                    │   │
│  │ 👤 Booked by: Kiley                              │   │
│  │                                                   │   │
│  │ [Update This Client] [View Details]              │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  [Create New Booking Anyway]  [Cancel]                 │
└─────────────────────────────────────────────────────────┘
```

### Actions Available
1. **Update This Client**: Opens a reschedule dialog to update the existing booking with new date/time
2. **View Details**: Shows full client history
3. **Create New Booking Anyway**: Dismisses the alert and allows the new booking to proceed (for genuinely different people with similar names)
4. **Cancel**: Clears the name field and closes the dialog

---

## Additional Features

### 1. Visual Warning Badge
After dismissing a duplicate warning, show a small warning badge on the booking entry indicating "Similar name exists" as a reminder.

### 2. Reschedule Flow
When "Update This Client" is selected:
- Pre-fill a dialog with the existing client's info
- Allow updating: class_date, intro_time, lead_source, notes
- Mark as rescheduled with audit trail

### 3. Status-Aware Matching
Include clients with these statuses in duplicate detection:
- Active
- 2nd Intro Scheduled
- Not interested (show warning: "This client was previously marked as not interested")
- No-show (show warning: "This client previously no-showed")

Exclude from matching:
- Closed (Purchased) - these are now members
- Deleted

---

## Technical Implementation

### Step 1: Create Duplicate Detection Hook
**New File**: `src/hooks/useDuplicateDetection.ts`

```typescript
export function useDuplicateDetection() {
  const checkForDuplicates = async (name: string): Promise<PotentialMatch[]> => {
    // Normalize the input name
    const normalizedInput = name.toLowerCase().trim();
    const nameParts = normalizedInput.split(' ').filter(Boolean);
    
    // Query existing bookings
    const { data } = await supabase
      .from('intros_booked')
      .select('*')
      .is('deleted_at', null)
      .not('booking_status', 'in', '("Closed (Purchased)","Deleted (soft)")');
    
    // Find matches using fuzzy logic
    return findMatches(normalizedInput, nameParts, data);
  };
  
  return { checkForDuplicates };
}
```

### Step 2: Create Duplicate Alert Dialog Component
**New File**: `src/components/DuplicateClientAlert.tsx`

This dialog will:
- Display potential duplicate matches
- Show client status with appropriate warnings
- Provide action buttons (Update, Create New, Cancel)
- Handle the reschedule flow inline

### Step 3: Create Reschedule Dialog Component
**New File**: `src/components/RescheduleClientDialog.tsx`

Allows updating:
- New intro date
- New intro time
- Updated notes
- Logs the edit with reason "Rescheduled by [SA name]"

### Step 4: Update IntroBookingEntry Component
**File**: `src/components/IntroBookingEntry.tsx`

Add:
- Debounced name change handler
- Integration with duplicate detection hook
- State for showing duplicate alert
- Warning badge for dismissed duplicates

### Step 5: Add Name Similarity Function
**File**: `src/lib/utils.ts`

```typescript
export function calculateNameSimilarity(name1: string, name2: string): number {
  // Levenshtein distance or simpler approach
  // Returns 0-1 similarity score
}

export function normalizeNameForComparison(name: string): string {
  return name.toLowerCase().trim().replace(/\s+/g, ' ');
}
```

---

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `src/hooks/useDuplicateDetection.ts` | Create | Hook for checking duplicates |
| `src/components/DuplicateClientAlert.tsx` | Create | Alert dialog component |
| `src/components/RescheduleClientDialog.tsx` | Create | Reschedule flow dialog |
| `src/components/IntroBookingEntry.tsx` | Modify | Add duplicate check on name entry |
| `src/lib/utils.ts` | Modify | Add name similarity functions |

---

## Data Flow

```text
User types name in IntroBookingEntry
         │
         ▼ (debounced 500ms)
useDuplicateDetection.checkForDuplicates()
         │
         ▼
Query intros_booked for similar names
         │
         ├── No matches → Proceed normally
         │
         └── Matches found → Show DuplicateClientAlert
                    │
                    ├── "Update This Client" → RescheduleClientDialog
                    │           │
                    │           └── Update booking → Toast success
                    │
                    ├── "Create New Anyway" → Set dismissedWarning flag
                    │
                    └── "Cancel" → Clear name field
```

---

## Matching Algorithm Details

### Priority Levels
1. **Exact Match** (100%): Normalized names are identical
2. **High Confidence** (>85%): Names differ by 1-2 characters (typos)
3. **Partial Match** (>60%): First OR last name matches exactly, other part is similar

### Edge Cases Handled
- "Sarah Johnson" vs "Sara Johnson" (typo)
- "Sarah Johnson" vs "Sarah Johnson-Smith" (hyphenated)
- "Sarah J" vs "Sarah Johnson" (abbreviated)
- "S. Johnson" vs "Sarah Johnson" (initial)

---

## Status-Based Warnings

| Previous Status | Warning Message |
|-----------------|-----------------|
| Active | "This client has an active intro scheduled" |
| 2nd Intro Scheduled | "This client is scheduled for a 2nd intro" |
| Not interested | "This client was previously marked as not interested" |
| No-show | "This client previously no-showed" |

---

## Testing Checklist

- [ ] Type an exact existing name and verify alert appears
- [ ] Type a similar name (off by one letter) and verify fuzzy match works
- [ ] Click "Update This Client" and verify reschedule flow works
- [ ] Click "Create New Anyway" and verify booking proceeds
- [ ] Verify warning badge appears after dismissing duplicate alert
- [ ] Test with various client statuses (Active, No-show, Not interested)
- [ ] Verify Closed (Purchased) clients are NOT flagged as duplicates

