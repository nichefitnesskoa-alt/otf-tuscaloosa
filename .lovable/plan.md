
# Fix 1: Follow-Up Queue — Show Only Current Due Touch
# Fix 2: Questionnaire Hub — Correct Tabs and Filtering

## Current State Analysis

### Follow-Up Queue (`FollowUpsDueToday.tsx`)
The component at `src/components/dashboard/FollowUpsDueToday.tsx` is the active follow-up queue on MyDay. The issue is in the `fetchQueue()` function at line 68–75:

```typescript
const { data, error } = await supabase
  .from('follow_up_queue')
  .select('*')
  .eq('status', 'pending')
  .lte('scheduled_date', today)   // ← Any pending touch past its date shows up
  .eq('is_vip', false)
  ...
```

This returns ALL pending touches with `scheduled_date <= today`. So if Amaya Grant has Touch 1 (due today) AND Touch 2 (overdue from a past incomplete cycle), both appear simultaneously. The deduplication by person is missing.

The rule to enforce:
1. For each person, only the **lowest `touch_number`** with status `pending` and `scheduled_date <= today` should show
2. Higher touch numbers are blocked until all lower-numbered touches are resolved (status `sent`, `skipped`, or `converted`)
3. The filter chips (All / No Show / Didn't Buy) at lines 280–281 use `items` (pre-filter), so they already reflect only visible items — no change needed there

**Fix**: After fetching and applying exit conditions, add a deduplication pass that groups by `person_name` and keeps only the row with the minimum `touch_number`. This is a pure client-side filter added at line 250, before `setItems(filtered)`.

Additionally, `scheduled_date` already enforces the "7 days later" rule if Touch 2 rows are created with the correct `scheduled_date` (7 days after Touch 1's `sent_at`). The current cadence uses `trigger_date + offset` (`DIDNT_BUY_CADENCE = [0, 6, 13]`), not "7 days after previous touch was marked done." This is the deeper structural issue — Touch 2's `scheduled_date` is computed at outcome-log time (offset from trigger), not when Touch 1 completes.

The spec says: "Touch 2 is not due until 7 days after Touch 1 was completed." This means Touch 2's `scheduled_date` needs to be updated when Touch 1 is marked Done. Two approaches:
- **Approach A (simpler)**: Keep pre-computed `scheduled_date`, but add client-side dedup by person_name keeping min touch_number. This prevents double-cards. The date-based suppression is already working via `lte('scheduled_date', today)`.
- **Approach B (correct cadence)**: When Touch 1 is marked done (`handleMarkSent`), update Touch 2's `scheduled_date` to `today + 7 days`. This is the proper fix for the "disappears for 7 days" requirement.

**We implement Approach B**: in `handleMarkSent` (line 310) and `handleSkip` (line 339), after updating the current touch status, fetch the next touch for the same person and update its `scheduled_date` to `today + 7 days` if it's currently in the past or too soon.

Plus Approach A's dedup as a safety net.

### Questionnaire Hub (`QuestionnaireHub.tsx`)

**Current tabs (5):** Pending | Sent | Completed | Not Int. | Bought

**Required tabs (6):** Needs Sending | Sent | Completed | Didn't Buy | Not Interested | Purchased

**Key problems to fix:**

1. **Tab rename**: "Pending" → "Needs Sending", "Bought" → "Purchased", add new "Didn't Buy" tab
2. **Sent tab contamination**: Currently `sent = filtered.filter(q => q.status === 'sent')` — this includes people with Purchased/Not Interested outcomes. Need to exclude closed outcomes from Sent tab.
3. **Missing "Didn't Buy" tab**: No tab exists for `result = "Didn't Buy"`. These records need their own tab.
4. **Purchased tab**: Need to detect `"Purchased (Premier w/o OTBeat)"` — current detection looks for `['premier', 'elite', 'basic'].some(k => res.includes(k))` which DOES match "Premier w/o OTBeat" since "premier" is in that string. So Miley Goetz should already appear — but she's likely being pulled into Completed or Sent instead because the `getQCategory` logic checks `isBought && isCompleted` for "bought", and if not completed, she falls through to a non-bought category.

**The real `getQCategory` bug** (line 235–246):
```typescript
if (isBought && isCompleted) return 'bought';     // only bought if ALSO completed
if (isNotInterested) return 'not-interested';
if (isCompleted) return 'completed';
if (q.status === 'sent') return 'sent';            // sent tab: no closed-outcome check
return 'pending';
```

If Miley has a questionnaire that's `status = 'sent'` (not completed), but she purchased, `isBought && isCompleted` is false so she doesn't get `'bought'` — she ends up in `'sent'` tab. **Fix**: `isBought` alone (regardless of questionnaire completion) should put her in `'purchased'`.

Also: the Sent tab query has no closed-outcome exclusion. Any purchased/not-interested/didn't-buy person with a `status = 'sent'` questionnaire appears in Sent.

**New closed outcome detection needed**: Add "Didn't Buy" detection parallel to existing purchased/not-interested detection using `intros_run.result = "Didn't Buy"`.

**New `getQCategory` logic:**
```
if (isBought) → 'purchased'              (regardless of questionnaire completion)
if (isNotInterested) → 'not-interested'
if (isDidntBuy) → 'didnt-buy'
if (isCompleted) → 'completed'
if (q.status === 'sent') → 'sent'
return 'needs-sending'
```

**New tab arrays:**
```typescript
const needsSending = filtered.filter(q => getQCategory(q) === 'needs-sending');
const sent = filtered.filter(q => getQCategory(q) === 'sent');
const completed = filtered.filter(q => getQCategory(q) === 'completed');
const didntBuy = filtered.filter(q => getQCategory(q) === 'didnt-buy');
const notInterested = filtered.filter(q => getQCategory(q) === 'not-interested');
const purchased = filtered.filter(q => getQCategory(q) === 'purchased');
```

**Action buttons on read-only tabs**: Purchased, Didn't Buy, Not Interested cards should NOT show the "Q Link" (send questionnaire) button. The `renderQCard` function needs a `readOnly` parameter that hides the copy-link button. The Prep, Script, Coach, Copy # buttons can remain on all tabs.

**Tab count badges**: Render counts inline in trigger labels.

**intros_booked fetch**: Need to also fetch `questionnaire_status_canon` from `intros_booked` to cross-reference. Currently not fetched. But since we're working purely from `intro_questionnaires.status` + `intros_run.result`, the existing data is sufficient.

## Files to Change

### `src/components/dashboard/FollowUpsDueToday.tsx`

**Change 1** — After the `filtered` array is built (line ~229), add a deduplication pass:
```typescript
// Keep only the lowest touch_number per person
const personMinTouch = new Map<string, number>();
for (const d of filtered) {
  const current = personMinTouch.get(d.person_name);
  if (current === undefined || d.touch_number < current) {
    personMinTouch.set(d.person_name, d.touch_number);
  }
}
const deduped = filtered.filter(d => d.touch_number === personMinTouch.get(d.person_name));
setItems(deduped as FollowUpItem[]);
```

**Change 2** — In `handleMarkSent` (line 310) and `handleSkip` (line 339), after updating the current touch, push the next touch's `scheduled_date` forward:
```typescript
// After marking current touch sent/skipped, advance next touch's due date
const nextTouchDate = format(addDays(new Date(), 7), 'yyyy-MM-dd');
await supabase
  .from('follow_up_queue')
  .update({ scheduled_date: nextTouchDate })
  .eq('person_name', item.person_name)
  .eq('touch_number', item.touch_number + 1)
  .eq('status', 'pending');
```

This means: Touch 2 (which had a pre-computed date) gets its `scheduled_date` bumped to 7 days from now when Touch 1 is resolved. The existing `lte('scheduled_date', today)` filter will then naturally suppress it until that future date arrives.

**Change 3** — In `handleMarkDone` (line 359), the current implementation sets ALL pending items to `converted` for the same person. This is incorrect — it marks the entire sequence as done. It should only mark the current touch and advance the next one. Fix:
```typescript
const handleMarkDone = async (item: FollowUpItem) => {
  // Mark only this touch as sent (not all pending for the person)
  await supabase
    .from('follow_up_queue')
    .update({ status: 'sent', sent_by: user?.name || 'Unknown', sent_at: new Date().toISOString() })
    .eq('id', item.id);
  
  // Advance next touch due date to 7 days from now
  const nextTouchDate = format(addDays(new Date(), 7), 'yyyy-MM-dd');
  await supabase
    .from('follow_up_queue')
    .update({ scheduled_date: nextTouchDate })
    .eq('person_name', item.person_name)
    .eq('touch_number', item.touch_number + 1)
    .eq('status', 'pending');
  
  toast.success('Marked as done');
  fetchQueue();
  onRefresh();
};
```

### `src/components/dashboard/QuestionnaireHub.tsx`

**Change 1** — Add `didntBuyBookingIds` and `didntBuyNames` computed sets (parallel to existing `purchasedBookingIds`/`notInterestedBookingIds`):
```typescript
const didntBuyBookingIds = useMemo(() => {
  const s = new Set<string>();
  runs.forEach(r => {
    if (r.result === "Didn't Buy" && r.linked_intro_booked_id) s.add(r.linked_intro_booked_id);
  });
  return s;
}, [runs]);

const didntBuyNames = useMemo(() => {
  const s = new Set<string>();
  runs.forEach(r => {
    if (r.result === "Didn't Buy") s.add(r.member_name.toLowerCase().trim());
  });
  return s;
}, [runs]);
```

**Change 2** — Rewrite `getQCategory` (line 235):
```typescript
const getQCategory = (q: QRecord): string => {
  const fullName = `${q.client_first_name} ${q.client_last_name}`.trim().toLowerCase();
  const isCompleted = q.status === 'completed' || q.status === 'submitted';
  const isBought = (q.booking_id && purchasedBookingIds.has(q.booking_id)) || purchasedNames.has(fullName);
  const isNotInterested = (q.booking_id && notInterestedBookingIds.has(q.booking_id)) || notInterestedNames.has(fullName);
  const isDidntBuy = (q.booking_id && didntBuyBookingIds.has(q.booking_id)) || didntBuyNames.has(fullName);

  if (isBought) return 'purchased';               // priority 1 — always wins
  if (isNotInterested) return 'not-interested';    // priority 2
  if (isDidntBuy) return 'didnt-buy';              // priority 3
  if (isCompleted) return 'completed';             // priority 4
  if (q.status === 'sent') return 'sent';          // priority 5
  return 'needs-sending';                           // default
};
```

**Change 3** — Recompute tab arrays:
```typescript
const needsSending = filtered.filter(q => getQCategory(q) === 'needs-sending');
const sent = filtered.filter(q => getQCategory(q) === 'sent');
const completed = filtered.filter(q => getQCategory(q) === 'completed');
const didntBuy = filtered.filter(q => getQCategory(q) === 'didnt-buy');
const notInterested = filtered.filter(q => getQCategory(q) === 'not-interested');
const purchased = filtered.filter(q => getQCategory(q) === 'purchased');
```

Remove old `pending`, `bought` variable declarations.

**Change 4** — Update `renderQCard` to accept a `readOnly` boolean. When `readOnly = true`, hide the "Q Link" button (copy questionnaire link / send button). Keep Prep, Script, Coach, Copy # available on all tabs. The "Q Link" button at line 514–522 is the send-questionnaire action and should be hidden for Purchased, Didn't Buy, Not Interested tabs.

**Change 5** — Rebuild the `<Tabs>` block with exactly 6 tabs in order:
```tsx
<Tabs defaultValue="needs-sending">
  <TabsList className="w-full grid grid-cols-3 mb-1">
    <TabsTrigger value="needs-sending" className="text-xs">Needs Sending ({needsSending.length})</TabsTrigger>
    <TabsTrigger value="sent" className="text-xs">Sent ({sent.length})</TabsTrigger>
    <TabsTrigger value="completed" className="text-xs">Completed ({completed.length})</TabsTrigger>
  </TabsList>
  <TabsList className="w-full grid grid-cols-3">
    <TabsTrigger value="didnt-buy" className="text-xs">Didn't Buy ({didntBuy.length})</TabsTrigger>
    <TabsTrigger value="not-interested" className="text-xs">Not Int. ({notInterested.length})</TabsTrigger>
    <TabsTrigger value="purchased" className="text-xs">Purchased ({purchased.length})</TabsTrigger>
  </TabsList>
  ...TabsContent for each...
</Tabs>
```

Note: 6 tabs won't fit in one row on mobile — using two rows of 3 (`grid-cols-3` each) is the correct approach.

**Change 6** — Update `getCategoryBadge` to include new category labels for `'purchased'`, `'needs-sending'`, `'didnt-buy'`.

**Change 7** — The `getPersonStatus` function (line 205) should also detect "Didn't Buy" to show the correct badge on cards in the Didn't Buy tab.

## Acceptance Checklist Coverage

| Check | Implementation |
|---|---|
| Only one card per person — the lowest pending touch | FollowUpsDueToday: dedup pass after exit-condition filter |
| Mark Touch 1 Done → disappears, Touch 2 not visible for 7 days | handleMarkDone: marks single touch, advances next touch scheduled_date +7d |
| Mark Touch 1 as Sent (via script) → same 7-day advance | handleMarkSent: same advance logic added |
| Questionnaire Sent tab: zero purchased/not-interested/didn't-buy | New `getQCategory` priority logic — closed outcomes win over `q.status === 'sent'` |
| Miley Goetz in Purchased tab | `isBought` now returns 'purchased' regardless of questionnaire completion status |
| Exactly 6 tabs in correct order | Tabs block rebuilt with 2 rows of 3 |
| Count badges on each tab | Counts embedded in TabsTrigger labels |
| Purchased/Didn't Buy/Not Interested: no Send Q button | `renderQCard(q, showAnswers, showCategoryBadge, readOnly=true)` hides Q Link button |

## Implementation Order

```
1. MODIFY src/components/dashboard/FollowUpsDueToday.tsx
   a. Add dedup pass (Change 1)
   b. Fix handleMarkDone to mark single touch only (Change 3)
   c. Add next-touch date advance to handleMarkSent (Change 2)
   d. Add next-touch date advance to handleSkip (Change 2)

2. MODIFY src/components/dashboard/QuestionnaireHub.tsx
   a. Add didntBuy detection sets (Change 1)
   b. Rewrite getQCategory (Change 2)
   c. Recompute tab arrays (Change 3)
   d. Add readOnly param to renderQCard (Change 4)
   e. Rebuild Tabs block with 6 tabs (Change 5)
   f. Update getCategoryBadge (Change 6)
   g. Update getPersonStatus for Didn't Buy (Change 7)
```

No database migrations needed. No new files. No edge function changes. Only these two component files.
