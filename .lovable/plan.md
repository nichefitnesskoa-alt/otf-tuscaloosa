

# Real-Time Name Typeahead for Duplicate Detection

## Overview

Replace the current alert-based duplicate detection with a real-time typeahead/autocomplete dropdown. As users type a member name, existing matches will appear in a dropdown below the input field, allowing them to:
1. See potential matches immediately
2. Select an existing client to reschedule/update
3. Continue typing a new name if no match applies

This is more intuitive and less interruptive than the modal approach.

---

## User Experience

### Visual Design

```text
Member Name *
┌──────────────────────────────────────────┐
│ Sar                                    ⌄ │
└──────────────────────────────────────────┘
┌──────────────────────────────────────────┐
│  Existing Clients                        │
│  ─────────────────────────────────────   │
│  ┌────────────────────────────────────┐  │
│  │ Sarah Johnson                      │  │
│  │ Active · Feb 5, 2026 · Instagram   │  │
│  └────────────────────────────────────┘  │
│  ┌────────────────────────────────────┐  │
│  │ Sara Williams                      │  │
│  │ No-show · Jan 28, 2026 · Lead Mgmt │  │
│  └────────────────────────────────────┘  │
│  ─────────────────────────────────────   │
│  ➕ Create "Sar" as new client           │
└──────────────────────────────────────────┘
```

### Interaction Flow

1. User starts typing in the Member Name field
2. After 2+ characters, a dropdown appears showing matching clients
3. Matches are sorted by similarity (best match first)
4. Each match shows: name, status badge, date, lead source
5. Clicking a match opens the Reschedule dialog
6. Clicking "Create as new client" closes dropdown and proceeds with new booking
7. Clicking outside or pressing Escape closes dropdown

---

## Technical Implementation

### Approach

Use the existing `cmdk` Command component (already installed) with a Popover to create a combobox-style autocomplete. This provides:
- Keyboard navigation (arrow keys, enter to select)
- Accessible ARIA patterns
- Smooth animations

### Files to Modify/Create

| File | Action | Purpose |
|------|--------|---------|
| `src/components/ClientNameAutocomplete.tsx` | Create | New autocomplete component |
| `src/components/IntroBookingEntry.tsx` | Modify | Replace Input with ClientNameAutocomplete |
| `src/hooks/useDuplicateDetection.ts` | Modify | Add more lenient matching for typeahead |

### Component Structure

**ClientNameAutocomplete.tsx**

```typescript
interface ClientNameAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onSelectExisting: (client: PotentialMatch) => void;
  currentUserName: string;
  disabled?: boolean;
}
```

Features:
- Uses Popover + Command from existing UI components
- Shows dropdown when input has 2+ characters and matches exist
- Displays status badges with color coding
- Shows warning icons for No-show/Not interested clients
- "Create new" option always at bottom
- Loading spinner while checking

### Updated Detection Logic

For typeahead, we want slightly more lenient matching to show more potential matches as user types:

```typescript
// Current: Only show matches with >0.6 similarity or partial match
// New: Show matches that START WITH the typed letters OR have >0.5 similarity
```

This ensures "Sa" will show "Sarah Johnson" even if similarity is low.

---

## Changes to IntroBookingEntry

Replace the current Input with the new autocomplete:

**Before:**
```tsx
<Input
  value={booking.memberName}
  onChange={(e) => handleNameChange(e.target.value)}
  placeholder="Full name"
/>
```

**After:**
```tsx
<ClientNameAutocomplete
  value={booking.memberName}
  onChange={handleNameChange}
  onSelectExisting={handleSelectExisting}
  currentUserName={currentUserName}
/>
```

Remove:
- `showDuplicateAlert` state
- `pendingMatches` state
- `useEffect` for debounced duplicate check
- `DuplicateClientAlert` component usage

Keep:
- `RescheduleClientDialog` - reuse for when user selects an existing client
- `dismissedWarning` state - still useful to show badge after creating anyway

---

## Keyboard Navigation

| Key | Action |
|-----|--------|
| Arrow Down | Move to next match |
| Arrow Up | Move to previous match |
| Enter | Select highlighted match |
| Escape | Close dropdown, keep typed text |
| Tab | Close dropdown, move to next field |

---

## Status Badge Colors

| Status | Badge Color | Icon |
|--------|-------------|------|
| Active | Green | None |
| 2nd Intro Scheduled | Blue | None |
| No-show | Red | Warning triangle |
| Not interested | Gray | Warning triangle |

---

## Edge Cases

1. **No matches found**: Dropdown shows only "Create as new client" option
2. **Exact match found**: Highlight strongly, show at top
3. **User clears input**: Close dropdown
4. **User pastes full name**: Trigger search immediately
5. **Very long client list**: Limit to 5 matches (already implemented)

---

## Files Summary

| File | Action |
|------|--------|
| `src/components/ClientNameAutocomplete.tsx` | Create new component |
| `src/components/IntroBookingEntry.tsx` | Replace Input, remove alert logic |
| `src/hooks/useDuplicateDetection.ts` | Add "starts with" matching for typeahead |
| `src/components/DuplicateClientAlert.tsx` | Delete (no longer needed) |

---

## Testing Checklist

- [ ] Type 2 characters and verify dropdown appears with matches
- [ ] Verify keyboard navigation works (up/down arrows, enter)
- [ ] Click an existing client and verify Reschedule dialog opens
- [ ] Click "Create as new client" and verify form proceeds normally
- [ ] Verify No-show clients show warning icon
- [ ] Test with exact name match - should appear first
- [ ] Test with partial/fuzzy match - should still appear
- [ ] Verify clicking outside closes dropdown
- [ ] Test on mobile - dropdown should be touch-friendly

