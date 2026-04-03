

# Fix: Shift Recap Dialog "Ran" Count Excludes No-Shows

## Summary
The "Confirm Shift Recap" dialog in `CloseOutShift.tsx` shows "Ran: 1" when it should show "Ran: 0" because it counts no-shows in the ran total. The GroupMe edge function already handles this correctly — the fix is only in the client-side recap dialog.

## File Change

### `src/components/dashboard/CloseOutShift.tsx`

**Line 170** — Change `ran` calculation to exclude no-shows:

Current:
```typescript
ran: (ran || []).length,
```

Change to:
```typescript
ran: (ran || []).filter(r => r.result_canon !== 'NO_SHOW' && r.result !== 'No-show').length,
```

This matches the exact same filter logic used in the edge function (line 115) and ensures the recap preview shows the same numbers that will be posted to GroupMe.

## What this does NOT change
- The GroupMe edge function — already correct
- No-show count — already correct (line 123)
- Sold, Follow-Up Needed, or any other metric
- No visual or layout changes

