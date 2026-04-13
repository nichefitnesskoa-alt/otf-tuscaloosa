

# Fix VIP Data + Weekly Calendar Grid

## Summary

Two changes scoped only to `/vip-availability`: delete the 10 duplicate bogus Apr 13 9:00 AM records, and rebuild the page as a weekly calendar grid with week navigation.

---

## FIX 1 — Delete Bad Seed Data

The generated data from Apr 14 onward is correct (matching templates). The only bad records are 10 duplicates on `2026-04-13` at `09:00:00`. Also one old cancelled record from `2026-02-22`.

**Action:** Use the insert tool to delete these specific bad records:
```sql
DELETE FROM vip_sessions 
WHERE session_date = '2026-04-13' AND session_time = '09:00:00' AND status = 'open';

DELETE FROM vip_sessions 
WHERE session_date < '2026-04-13' AND created_by = 'system';
```

The edge function logic itself is correct for future generation — the bug was from an earlier broken version that ran once. No function code change needed.

---

## FIX 2 — Weekly Calendar Grid Layout

**File:** `src/pages/VipAvailability.tsx` — full rewrite of the layout below the header.

### Week Navigation Bar
- `< Previous Week` | **Week of April 13** | `Next Week >`
- Default: current week (Mon-based)
- Previous disabled when viewing current week
- State: `weekOffset` number (0 = current week)

### Desktop Grid (7 columns)
- Headers: `Mon 13`, `Tue 14`, etc. Today's column gets orange bottom border.
- Each column lists that day's slots as compact pills:
  - **Available:** green-500 left border, bold time, "Available" green text. Tap expands to show orange "Claim This Slot" button.
  - **Reserved:** amber-500 left border, muted time, "Reserved" amber text, italic group name below.
- Empty days show centered "—" in muted text.

### Mobile Layout
- Horizontal scrollable day tabs at top (Mon–Sun), matching existing app patterns.
- Single day view below showing that day's slots.
- Default to today's tab.

### Claim Flow
- Tapping "Claim This Slot" button opens a **Dialog** modal (not inline expansion).
- Modal contains the same 5-field form (name, group, email, phone, size).
- On success: confirmation message shown inside the modal.
- Same race-condition protection logic as current.

### Real-time
- Same `postgres_changes` subscription — when a slot flips to reserved, the pill updates immediately.

---

## Files Changed

| File | Action |
|------|--------|
| `src/pages/VipAvailability.tsx` | Rewrite layout to weekly grid |
| Database (insert tool) | Delete 10 bad Apr 13 records |

## What Does NOT Change
- Edge function code
- VipSchedulerTab
- Any other page or component
- Claim logic / notification logic (just moved into a Dialog)

