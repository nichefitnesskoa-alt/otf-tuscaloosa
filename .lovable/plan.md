

# Fix NameAutocomplete Click/Focus Issue

## Problem
The `NameAutocomplete` component wraps its `Input` inside a Radix `PopoverTrigger`. When used inside a Sheet or Dialog (like BookIntroSheet, WalkInIntroSheet, IntroBookingEntry), the Popover defaults to `modal={true}`, which fights with the parent modal for focus control. This prevents clicking into the field and typing.

## Fix

**File: `src/components/shared/NameAutocomplete.tsx`**

Add `modal={false}` to the `<Popover>` component:

```tsx
<Popover open={open} onOpenChange={setOpen} modal={false}>
```

This single change fixes the focus conflict everywhere NameAutocomplete is used:
- BookIntroSheet (Member Referral → "Who referred them?")
- WalkInIntroSheet (same referral field)
- IntroBookingEntry (referred by field)
- Any other form using NameAutocomplete

## What does NOT change
- Autocomplete search behavior, suggestion rendering, or selection logic
- Any other component or page

