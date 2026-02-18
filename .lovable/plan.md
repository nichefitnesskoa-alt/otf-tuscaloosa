
# Plan: Remove GroupMe Card + Fix Shift Summary Conflict Key

## What Needs To Change

### 1. Remove the "Share to GroupMe" card entirely from `src/pages/Recaps.tsx`

Lines 492–513 contain the entire `<Card>` block with the title "Share to GroupMe" and three buttons. These need to be deleted completely — no rename, no stub.

Also remove line 525 which contains the retired "Lead Measures" description in the Legend card.

The imports for `Copy` and `Download` from lucide-react (line 7) also need to be cleaned up since those icons are only used in the removed card. Same for the three handler functions `handleCopyPersonalSummary`, `handleCopyStudioSummary`, and `handleDownloadCSV` — those dead functions should also be removed to keep the file clean.

### 2. Create `src/features/myDay/MyDayShiftSummary.tsx` with the correct conflict key

The `shift_recaps` table stores **one row per staff member per day per shift type**. The live data confirms this: on 2026-02-13, "Bri" has a "Mid Shift" and "Kayla" has an "AM Shift". On 2026-02-11, "Katie" has two separate "PM Shift" rows. The column values are "AM Shift", "Mid Shift", "PM Shift".

The previous plan's upsert used `(staff_name, shift_date)` as the conflict key — this is **wrong** because it would overwrite AM data when PM is saved.

The correct conflict target is `(staff_name, shift_date, shift_type)`. However, for this to work as an `ON CONFLICT` key, a unique constraint must exist on those three columns. We need to verify this or add a migration if it doesn't exist.

The component will:
- Let the SA select shift type from: AM Shift, Mid Shift, PM Shift
- Load existing data for that `(staff_name, shift_date, shift_type)` combination on mount/change
- Show number inputs for: Outbound calls, Outbound texts, Instagram DMs
- Upsert to `shift_recaps` with conflict on `(staff_name, shift_date, shift_type)`
- Write to the same columns Studio reads: `calls_made`, `texts_sent`, `dms_sent`

## Files to Change

### `src/pages/Recaps.tsx`
- **Remove lines 492–513**: the entire "Share to GroupMe" `<Card>` block
- **Remove line 525**: the "Lead Measures" line from the Legend card
- **Remove** `Copy`, `Download` from the lucide-react import on line 7 (only used in the removed card)
- **Remove** the three dead handler functions `generatePersonalSummaryText`, `generateStudioSummaryText`, `handleCopyPersonalSummary`, `handleCopyStudioSummary`, `handleDownloadCSV` — they are only called by the removed buttons

### `src/features/myDay/MyDayShiftSummary.tsx` (new file)
Create this component with:
- Shift type selector (AM Shift / Mid Shift / PM Shift) — defaults to AM Shift
- Number inputs for calls, texts, DMs
- Auto-loads existing row on mount for today's date + selected shift type
- Save button upserts to `shift_recaps` with conflict on `(staff_name, shift_date, shift_type)`

### Migration (if needed)
Check if `shift_recaps` has a unique constraint on `(staff_name, shift_date, shift_type)`. If not, add one so the upsert conflict target works. This is a safe migration — the live data shows no duplicate `(staff_name, shift_date, shift_type)` combinations.

### `src/features/myDay/MyDayPage.tsx`
Wire `MyDayShiftSummary` into the page below the intros sections.

## Technical Details

### Recaps.tsx — exact removal

The export card (lines 492–513):
```
{/* Export Actions */}
<Card>
  <CardHeader className="pb-2">
    <CardTitle className="text-sm">Share to GroupMe</CardTitle>
  </CardHeader>
  <CardContent className="p-4 pt-0">
    ...
  </CardContent>
</Card>
```
Delete entirely. Nothing replaces it.

The Legend card line 525:
```
<strong>Lead Measures</strong> = Goal+Why capture, Peak Gym Experience, Made a Friend
```
Delete just this line and the preceding `<br />`.

### MyDayShiftSummary conflict key

```typescript
await supabase
  .from('shift_recaps')
  .upsert(
    {
      staff_name: userName,
      shift_date: todayStr,
      shift_type: shiftType,       // "AM Shift" | "Mid Shift" | "PM Shift"
      calls_made: calls,
      texts_sent: texts,
      dms_sent: dms,
    },
    { onConflict: 'staff_name,shift_date,shift_type' }
  );
```

For this to work, a unique index/constraint must exist. Migration SQL:
```sql
ALTER TABLE shift_recaps
  ADD CONSTRAINT shift_recaps_staff_date_type_unique
  UNIQUE (staff_name, shift_date, shift_type);
```

This is safe — the current data shows no collisions on these three columns.

## Acceptance Checklist

- [ ] Studio tab opens. The "Share to GroupMe" card is gone. No empty space stub, just gone.
- [ ] Legend card no longer mentions "Lead Measures = Goal+Why capture..."
- [ ] MyDay has a shift activity section with shift type picker, call/text/DM inputs, and save button
- [ ] Saving AM Shift data, then saving PM Shift data does NOT overwrite the AM row
- [ ] Studio scoreboard still reads from `shift_recaps` correctly (no table changes, only a unique constraint added)
- [ ] No build errors — unused imports and dead handler functions are cleaned up
