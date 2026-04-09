

# Fix NameAutocomplete Input Not Accepting Clicks/Typing

## Problem
The `Input` is wrapped in `PopoverTrigger asChild`, which makes Radix treat the input as a toggle button. Clicking the input fires the trigger's onClick handler (toggling the popover open/closed) instead of simply focusing the input for typing. Inside a Sheet, this creates a dead input.

## Fix

**File: `src/components/shared/NameAutocomplete.tsx`**

Stop using `PopoverTrigger asChild` around the `Input`. Instead, wrap both the Input and PopoverContent in a plain `div` and use `PopoverAnchor` (from Radix) to anchor the dropdown to the input without making the input a toggle trigger.

The restructured component:

```tsx
<Popover open={open} onOpenChange={setOpen} modal={false}>
  <PopoverAnchor asChild>
    <Input
      ref={inputRef}
      value={value}
      onChange={e => handleChange(e.target.value)}
      onFocus={() => { if (suggestions.length > 0) setOpen(true); }}
      onBlur={() => setTimeout(() => setOpen(false), 200)}
      placeholder={placeholder}
      disabled={disabled}
      autoComplete="off"
    />
  </PopoverAnchor>
  {open && suggestions.length > 0 && (
    <PopoverContent ...>
      {/* suggestion list unchanged */}
    </PopoverContent>
  )}
</Popover>
```

- Import `PopoverAnchor` from `@/components/ui/popover` (re-export from Radix)
- Add `PopoverAnchor` export in `src/components/ui/popover.tsx`
- Replace `PopoverTrigger asChild` with `PopoverAnchor asChild` — this tells the popover where to position the dropdown without adding click-to-toggle behavior
- Input click/focus/typing works normally; popover opens only via the `open` state controlled by `onFocus` and the debounced search

## What does NOT change
- Search logic, suggestion rendering, selection behavior
- Any other component or page

