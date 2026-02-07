
# Add Coach Field to Manual Intro Run Entry

## Overview

When manually entering an intro run (not selecting from booked intros), the user needs to specify which coach led the class. This allows proper tracking of coach performance even for walk-ins or manually entered intro sessions.

---

## What Will Change

### User Experience
- In the "Intros Run" section, when using **Manual Entry** mode, a new "Coach" dropdown will appear after the Lead Source field
- The dropdown will contain the list of coaches: Bre, Elizabeth, James, Kaitlyn H, Nathan, Natalya
- This field is optional but recommended for accurate coach performance tracking

---

## Technical Implementation

### Step 1: Database Migration
Add `coach_name` column to the `intros_run` table:

```sql
ALTER TABLE intros_run ADD COLUMN coach_name text;
```

### Step 2: Update IntroRunData Interface
**File**: `src/components/IntroRunEntry.tsx`

Add `coachName` to the data interface:
```typescript
export interface IntroRunData {
  id: string;
  memberName: string;
  runDate: string;
  runTime: string;
  leadSource: string;
  coachName: string;  // NEW FIELD
  outcome: string;
  // ... rest unchanged
}
```

### Step 3: Add Coach Dropdown UI
**File**: `src/components/IntroRunEntry.tsx`

Add a coach selector in manual entry mode (after Lead Source):
```typescript
{entryMode === 'manual' && (
  <div>
    <Label className="text-xs">Coach</Label>
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
```

### Step 4: Include Coach in Database Insert
**File**: `src/pages/ShiftRecap.tsx`

When inserting the intro run record, include the coach_name:
```typescript
const { error: runError } = await supabase.from('intros_run').insert({
  // ... existing fields
  coach_name: run.coachName || null,  // NEW
});
```

### Step 5: Update Default IntroRun State
**File**: `src/pages/ShiftRecap.tsx`

Update the `addIntroRun` function to include the new field:
```typescript
const newRun: IntroRunData = {
  id: `run_${Date.now()}`,
  memberName: '',
  runDate: date,
  runTime: '',
  leadSource: '',
  coachName: '',  // NEW
  outcome: '',
  // ... rest
};
```

---

## Files to Modify

| File | Changes |
|------|---------|
| **Database** | Add `coach_name` text column to `intros_run` |
| `src/components/IntroRunEntry.tsx` | Add `coachName` to interface, add Coach dropdown in manual mode |
| `src/pages/ShiftRecap.tsx` | Include `coach_name` in insert, add to default state |

---

## Notes

- When selecting from booked intros, the coach is already captured in the `intros_booked` table and linked via `linked_intro_booked_id`
- This new field is specifically for manual entries where there's no existing booking to reference
- The coach field is optional to allow flexibility for edge cases
