&nbsp;

The "They came in" button needs to be bigger or clearer to that that is something that is clickable. Maybe closer to the edit button in the center. Other than that everything is good after makign that change  
  
Plan: Real-Time Auto-Detection of Friend Show-Ups  


### Problem

The friend "showed up" detection currently only runs inside `MilestonesDeploySection.loadData()` — meaning it only checks when someone opens the WIG page. If a friend books an intro, shows up, or gets added as a lead, the milestone's `friend_showed_up` stays `false` until someone manually visits WIG.

### Solution

Add a Supabase realtime subscription inside `MilestonesDeploySection` that listens for changes on `intros_booked`, `intros_run`, and `leads`. When any INSERT or UPDATE arrives on those tables, re-run the friend detection logic by calling `loadData()`.

This keeps the detection co-located with the existing logic (no new edge function needed) and ensures the WIG page stays live while open. For cases where nobody has WIG open, the existing `loadData()` auto-detection on mount already catches up — so the DB will be updated the next time anyone views the page.

### File Changed

`**src/components/dashboard/MilestonesDeploySection.tsx**`

Add a `useEffect` that creates a Supabase realtime channel subscribing to:

- `intros_booked` — INSERT and UPDATE (friend books or shows)
- `intros_run` — INSERT (friend's intro is run, may be SALE)
- `leads` — INSERT (friend added as lead with pack source)

On any event, call `loadData()` which already handles the three-way detection and auto-updates `friend_showed_up` in the DB.

```typescript
useEffect(() => {
  const channel = supabase
    .channel('friend-showup-detect')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'intros_booked' }, () => loadData())
    .on('postgres_changes', { event: '*', schema: 'public', table: 'intros_run' }, () => loadData())
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'leads' }, () => loadData())
    .subscribe();
  return () => { supabase.removeChannel(channel); };
}, [loadData]);
```

This is a single small addition (~10 lines). No other files change.